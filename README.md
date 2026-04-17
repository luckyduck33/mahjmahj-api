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

## Environment Variables

- `NOTION_API_KEY` — Notion integration token (read-only access)

## Deployment

Deployed on Vercel at `api.mahjmahj.co`. Push to `main` to auto-deploy.
