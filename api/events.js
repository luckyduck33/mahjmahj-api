const { getNotionClient } = require('./_lib/notion');
const { handleCors, setCacheHeaders } = require('./_lib/cors');

const EVENTS_DB_ID = '39cb97bf-5b93-4828-b379-ad7448a17682';

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const notion = getNotionClient();
    const { city, status, style, type, limit, featured } = req.query;

    // Build Notion filter
    const filters = [];

    // Status filter: default to Upcoming + Ongoing unless status=all
    if (status && status.toLowerCase() === 'all') {
      // No status filter
    } else if (status) {
      filters.push({
        property: 'Status',
        select: { equals: status },
      });
    } else {
      filters.push({
        or: [
          { property: 'Status', select: { equals: 'Upcoming' } },
          { property: 'Status', select: { equals: 'Ongoing' } },
        ],
      });
    }

    if (city) {
      filters.push({
        property: 'City',
        select: { equals: city },
      });
    }

    if (style) {
      filters.push({
        property: 'Mahjong Style',
        multi_select: { contains: style },
      });
    }

    if (type) {
      filters.push({
        property: 'Event Type',
        multi_select: { contains: type },
      });
    }

    const queryParams = {
      database_id: EVENTS_DB_ID,
      sorts: [{ property: 'Date', direction: 'ascending' }],
      page_size: 100,
    };

    if (filters.length === 1) {
      queryParams.filter = filters[0];
    } else if (filters.length > 1) {
      queryParams.filter = { and: filters };
    }

    // Paginate through all results
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      if (startCursor) queryParams.start_cursor = startCursor;
      const response = await notion.databases.query(queryParams);
      allResults = allResults.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;

      if (allResults.length >= 500) break;
    }

    // Apply limit
    const maxResults = Math.min(parseInt(limit) || 50, 200);
    const limited = allResults.slice(0, maxResults);

    // Transform results
    const events = limited.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        title: getTitle(p['Event Title']),
        date: getDateStart(p['Date']),
        time: getRichText(p['Time']),
        city: getSelect(p['City']),
        neighborhood: getRichText(p['Neighborhood / Venue Area']),
        address: getRichText(p['Full Address']),
        host: getRichText(p['Host / Organizer']),
        cost: getRichText(p['Cost']),
        styles: getMultiSelect(p['Mahjong Style']),
        eventType: getMultiSelect(p['Event Type']),
        skillLevel: getMultiSelect(p['Skill Level']),
        recurring: getSelect(p['Recurring']),
        recurrencePattern: getRichText(p['Recurrence Pattern']),
        registrationLink: getUrl(p['Registration Link']),
        description: getRichText(p['Description']),
        status: getSelect(p['Status']),
        instagramHandle: getRichText(p['Instagram Handle']),
      };
    });

    setCacheHeaders(res);
    res.status(200).json({
      events,
      total: events.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Events API error:', err);

    // Notion returns validation_error when a filter value doesn't exist in select options
    if (err.code === 'validation_error') {
      setCacheHeaders(res);
      res.status(200).json({
        events: [],
        total: 0,
        lastUpdated: new Date().toISOString(),
      });
      return;
    }

    if (err.code === 'notionhq_client_response_error' || err.message?.includes('fetch')) {
      res.status(503).json({ error: 'Notion API unavailable', retry: true });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// --- Property extractors ---

function getTitle(prop) {
  if (!prop || !prop.title) return '';
  return prop.title.map(t => t.plain_text).join('');
}

function getRichText(prop) {
  if (!prop || !prop.rich_text) return '';
  return prop.rich_text.map(t => t.plain_text).join('');
}

function getSelect(prop) {
  if (!prop || !prop.select) return null;
  return prop.select.name || null;
}

function getMultiSelect(prop) {
  if (!prop || !prop.multi_select) return [];
  return prop.multi_select.map(s => s.name);
}

function getDateStart(prop) {
  if (!prop || !prop.date) return null;
  return prop.date.start || null;
}

function getUrl(prop) {
  if (!prop || prop.type !== 'url') return null;
  return prop.url || null;
}
