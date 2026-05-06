const { getNotionClient } = require('../_lib/notion');

const NEWS_DB_ID = 'b544b77c-f377-40f7-b389-72dbbc48a5d7';
const STALE_DAYS = 30;

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

function getTitle(prop) {
  if (!prop || !prop.title) return '';
  return prop.title.map((t) => t.plain_text).join('');
}

function getRichText(prop) {
  if (!prop || !prop.rich_text) return '';
  return prop.rich_text.map((t) => t.plain_text).join('');
}

// Identical to news.js parseDateText so the cron and the public endpoint
// never disagree about how to read a date string. Returns 0 on unparseable.
function parseDateText(dateStr) {
  if (!dateStr) return 0;
  const ts = Date.parse(dateStr);
  if (!isNaN(ts)) return ts;
  const monthYear = dateStr.match(/^(\w+)\s+(\d{4})$/);
  if (monthYear) {
    const ts2 = Date.parse(monthYear[1] + ' 1, ' + monthYear[2]);
    if (!isNaN(ts2)) return ts2;
  }
  return 0;
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
  const nowMs = Date.now();
  const cutoffMs = nowMs - STALE_DAYS * 86400 * 1000;

  try {
    const notion = getNotionClient();

    const activePages = await queryAll(notion, {
      database_id: NEWS_DB_ID,
      filter: { property: 'Active', checkbox: { equals: true } },
      page_size: 100,
    });

    const deactivated = [];
    const unparseable = [];
    const failures = [];
    let kept = 0;

    for (const page of activePages) {
      const title = getTitle(page.properties['Title']);
      const dateStr = getRichText(page.properties['Date']);
      const ts = parseDateText(dateStr);

      if (ts === 0) {
        unparseable.push({ id: page.id, title, date: dateStr });
        continue;
      }
      if (ts >= cutoffMs) {
        kept++;
        continue;
      }

      const ageDays = Math.floor((nowMs - ts) / 86400000);
      try {
        await notion.pages.update({
          page_id: page.id,
          properties: { Active: { checkbox: false } },
        });
        deactivated.push({ id: page.id, title, date: dateStr, ageDays });
      } catch (e) {
        failures.push({
          id: page.id,
          title,
          date: dateStr,
          ageDays,
          error: e.message || String(e),
        });
      }
    }

    const summary = {
      runAt: startedAt,
      cutoffDays: STALE_DAYS,
      activeBefore: activePages.length,
      kept,
      deactivatedCount: deactivated.length,
      deactivated,
      unparseableCount: unparseable.length,
      unparseable,
      failureCount: failures.length,
      failures,
    };

    console.log('[refresh-news]', JSON.stringify(summary));
    res.status(200).json(summary);
  } catch (err) {
    console.error('[refresh-news] fatal:', err);
    res.status(500).json({
      error: err.message || 'Internal error',
      code: err.code,
      runAt: startedAt,
    });
  }
};
