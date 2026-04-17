const { getNotionClient } = require('./_lib/notion');
const { handleCors, setCacheHeaders } = require('./_lib/cors');

const NEWS_DB_ID = 'b544b77c-f377-40f7-b389-72dbbc48a5d7';

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const notion = getNotionClient();
    const { category, featured, active, limit } = req.query;

    // Build Notion filter
    const filters = [];

    // Active filter: default to true (only active items) unless active=all
    if (active && active.toLowerCase() === 'all') {
      // No active filter
    } else {
      filters.push({
        property: 'Active',
        checkbox: { equals: true },
      });
    }

    if (category) {
      filters.push({
        property: 'Category',
        select: { equals: category },
      });
    }

    if (featured === 'true') {
      filters.push({
        property: 'Featured',
        checkbox: { equals: true },
      });
    }

    const queryParams = {
      database_id: NEWS_DB_ID,
      // News DB "Date" is a text field, not a date field, so we sort by createdTime as fallback
      // and then do client-side sort by the text Date field
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

    // Transform results
    const news = allResults.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        title: getTitle(p['Title']),
        summary: getRichText(p['Summary']),
        category: getSelect(p['Category']),
        date: getRichText(p['Date']),
        source: getRichText(p['Source']),
        url: getUrl(p['URL']),
        imageUrl: getUrl(p['Image URL']),
        whyItMatters: getRichText(p['Why It Matters']),
        featured: getCheckbox(p['Featured']),
      };
    });

    // Sort by date descending (newest first). Date is a text field like "2026-04-15"
    news.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });

    // Apply limit
    const maxResults = Math.min(parseInt(limit) || 20, 200);
    const limited = news.slice(0, maxResults);

    setCacheHeaders(res);
    res.status(200).json({
      news: limited,
      total: limited.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('News API error:', err);
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

function getCheckbox(prop) {
  if (!prop) return false;
  return prop.checkbox === true;
}

function getUrl(prop) {
  if (!prop || prop.type !== 'url') return null;
  return prop.url || null;
}
