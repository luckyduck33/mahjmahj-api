const { getNotionClient } = require('../_lib/notion');

const EVENTS_DB_ID = '39cb97bf-5b93-4828-b379-ad7448a17682';
const LIVE_STATUSES = ['Upcoming', 'Ongoing'];
const EXPIRED_STATUS = 'Past';

function getTodayInPT() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isAuthorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return (req.headers.authorization || '') === `Bearer ${expected}`;
}

async function queryAll(notion, params) {
  const all = [];
  let cursor;
  for (;;) {
    const res = await notion.databases.query(
      cursor ? { ...params, start_cursor: cursor } : params
    );
    for (const r of res.results) all.push(r);
    if (!res.has_more) break;
    cursor = res.next_cursor;
    if (all.length >= 1000) break;
  }
  return all;
}

function getSelectName(prop) {
  return prop && prop.select ? prop.select.name || null : null;
}

function getDateStart(prop) {
  return prop && prop.date ? prop.date.start || null : null;
}

function getTitleText(prop) {
  if (!prop || !prop.title) return '';
  return prop.title.map((t) => t.plain_text).join('');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const startedAt = new Date().toISOString();
  const today = getTodayInPT();

  try {
    const notion = getNotionClient();

    const stalePages = await queryAll(notion, {
      database_id: EVENTS_DB_ID,
      filter: {
        and: [
          { property: 'Date', date: { before: today } },
          {
            or: LIVE_STATUSES.map((s) => ({
              property: 'Status',
              select: { equals: s },
            })),
          },
        ],
      },
      page_size: 100,
    });

    const expired = [];
    const failures = [];
    for (const page of stalePages) {
      const title = getTitleText(page.properties['Event Title']);
      const date = getDateStart(page.properties['Date']);
      const city = getSelectName(page.properties['City']);
      const oldStatus = getSelectName(page.properties['Status']);
      try {
        await notion.pages.update({
          page_id: page.id,
          properties: { Status: { select: { name: EXPIRED_STATUS } } },
        });
        expired.push({ id: page.id, title, date, city, oldStatus });
      } catch (e) {
        failures.push({
          id: page.id,
          title,
          date,
          city,
          error: e.message || String(e),
        });
      }
    }

    const dbInfo = await notion.databases.retrieve({ database_id: EVENTS_DB_ID });
    const cityProp = dbInfo.properties && dbInfo.properties['City'];
    const allCities = (
      (cityProp && cityProp.select && cityProp.select.options) || []
    ).map((o) => o.name);

    const liveEvents = await queryAll(notion, {
      database_id: EVENTS_DB_ID,
      filter: {
        or: LIVE_STATUSES.map((s) => ({
          property: 'Status',
          select: { equals: s },
        })),
      },
      page_size: 100,
    });

    const cityCounts = {};
    for (const c of allCities) cityCounts[c] = 0;
    for (const p of liveEvents) {
      const c = getSelectName(p.properties['City']);
      if (c) cityCounts[c] = (cityCounts[c] || 0) + 1;
    }
    const staleCities = Object.entries(cityCounts)
      .filter(([, n]) => n === 0)
      .map(([c]) => c)
      .sort();

    const summary = {
      runAt: startedAt,
      todayPT: today,
      expiredCount: expired.length,
      expired,
      failureCount: failures.length,
      failures,
      liveEventCount: liveEvents.length,
      cityCounts,
      staleCityCount: staleCities.length,
      staleCities,
    };

    console.log('[expire-events]', JSON.stringify(summary));
    res.status(200).json(summary);
  } catch (err) {
    console.error('[expire-events] fatal:', err);
    res.status(500).json({
      error: err.message || 'Internal error',
      code: err.code,
      runAt: startedAt,
      todayPT: today,
    });
  }
};
