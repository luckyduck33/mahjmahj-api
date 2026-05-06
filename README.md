# MAHJ MAHJ Content API

Notion-backed JSON API for MAHJ MAHJ events and news content.

## Endpoints

### `GET /api/events`
Returns events sorted by date ascending (soonest first).

**Query parameters (all optional):**
- `city` — filter by city (e.g., `Los Angeles`)
- `status` — filter by status; defaults to `Upcoming` + `Ongoing`; pass `all` for everything
- `style` — filter by Mahjong style (e.g., `Hong Kong`)
- `type` — filter by event type (e.g., `Tournament`)
- `limit` — max results (default: 50, max: 200)
- `featured` — reserved for future use

### `GET /api/news`
Returns news items sorted by date descending (newest first).

**Query parameters (all optional):**
- `category` — filter by category (e.g., `Culture`)
- `featured` — `true` to show only featured items
- `active` — defaults to active-only; pass `all` for everything
- `limit` — max results (default: 20, max: 200)

### `POST /api/cron/expire-events` (internal)
Daily Vercel Cron. Flips `Status` to `Past` on any event whose `Date` is before today (PT) and whose `Status` is still `Upcoming` or `Ongoing`. Then computes which cities have zero remaining live events and returns the list. Idempotent. Auth-gated by `Authorization: Bearer ${CRON_SECRET}`. Schedule: `0 8 * * *` UTC (= midnight PST / 1am PDT).

Response shape:
```json
{
  "runAt": "2026-05-04T08:00:00.000Z",
  "todayPT": "2026-05-04",
  "expiredCount": 5,
  "expired": [{ "id": "...", "title": "...", "date": "2026-04-11", "city": "Los Angeles", "oldStatus": "Ongoing" }],
  "failureCount": 0,
  "failures": [],
  "liveEventCount": 45,
  "cityCounts": { "Los Angeles": 8, "Boston": 0, "...": 0 },
  "staleCityCount": 3,
  "staleCities": ["Boston", "Miami", "Online"]
}
```

### `POST /api/cron/refresh-news` (internal)
Daily Vercel Cron. Sets `Active = false` on any news item whose `Date` parses to more than 30 days ago. The `Date` field is rich-text in Notion (mixed formats: ISO `2026-04-20`, `April 17, 2026`, `April 2026`, etc.) — parsed using the same `parseDateText` helper as `/api/news` so the cron and the public endpoint never disagree. Items whose date is unparseable (e.g., bare `2025`, date ranges like `May 15–17, 2026`) are listed in the response under `unparseable` and **not** modified, so a future event date is never accidentally deactivated. Idempotent. Auth-gated by `Authorization: Bearer ${CRON_SECRET}`. Schedule: `0 9 * * *` UTC (one hour after the events cron).

Response shape:
```json
{
  "runAt": "2026-05-06T09:00:00.000Z",
  "cutoffDays": 30,
  "activeBefore": 52,
  "kept": 22,
  "deactivatedCount": 25,
  "deactivated": [{ "id": "...", "title": "...", "date": "April 6, 2026", "ageDays": 30 }],
  "unparseableCount": 5,
  "unparseable": [{ "id": "...", "title": "...", "date": "2025" }],
  "failureCount": 0,
  "failures": []
}
```

## Environment Variables

- `NOTION_API_KEY` — Notion integration token (must have read + update access on both the Events and News DBs)
- `CRON_SECRET` — bearer token Vercel Cron passes when invoking `/api/cron/*` endpoints

## Deployment

Deployed on Vercel at `api.mahjmahj.co`. Push to `main` to auto-deploy.
