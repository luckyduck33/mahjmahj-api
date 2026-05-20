# Lucky Media Corp — Shared Operating Rules

## Before Starting Any Task
1. Confirm venture and repo match the task
2. Check the Code Queue filtered view on the Task Board — not semantic search
3. Search 3-5 keywords to check for duplicate tasks before creating new ones
4. Read the full task page content for spec (not just the title)

## Task Title Convention
Format: `{Assignee} — {Verb} {Object} ({Context})`

## Output Naming
- Content for publishing: `PUBLISH: {Venture} — {Title}`
- Data for another agent: `DATA HANDOFF: {Venture} — {Description} — for {Agent}`
- Items needing review: `REVIEW: {Venture} — {Item}`

## After Completing Any Task
1. Set Notion task Status = Done
2. Add completion note: `{YYYY-MM-DD HH:MM PT} — Completed by Code. {Summary}. Commit: {hash}.`
3. Log to Command Center: POST /api/log-output with X-Dashboard-Token header
4. If task creates work for another agent, create the handoff BEFORE marking Done
5. If Requires Human Review is checked, mark Done once deliverable is complete — Nidhi approval is separate

## If Blocked
- Leave Status = In progress
- Add note: `{YYYY-MM-DD HH:MM PT} — BLOCKED: {reason}. Needs: {what}. Next: {who}.`
- Log blocked status to Dashboard

## Source of Truth
- Task status: Notion Task Board filtered views
- Venture facts: ~/Desktop/CLAUDE/Operations/lucky-venture-registry.md
- Cross-agent workflow: ~/Desktop/CLAUDE/Operations/lucky-shared-protocol.md
- This repo's behavior: this CLAUDE.md

## Source-of-Truth Gate
See **Source-of-Truth Gate** in `~/Desktop/CLAUDE/Operations/lucky-shared-protocol.md`. All factual claims (numbers, prices, calculations, scores, dates, medical claims, business listings) require stated sources. Invented or estimated data presented as fact is a P0 bug regardless of feature priority.

## Timestamps
All outputs: YYYY-MM-DD HH:MM PT (Pacific Time)

---

# mahjmahj-api

Backend API for MAHJ MAHJ. Serves events + news at `https://api.mahjmahj.co`, consumed by `mahjmahj-web` (marketing site) and `mahj-mahj` (the app). GitHub: `luckyduck33/mahjmahj-api`. Full brand details: see the `lucky-ventures` skill.

## Stack
- Node API (see `package.json` for exact framework)
- Vercel-hosted (`vercel.json` present)

## Architecture
- This is the source of truth for events and news data.
- `mahjmahj-web` and `mahj-mahj` consume this API — schema changes must be coordinated.
- City taxonomy: the consumer apps own the city manifest (`mahjmahj-web/src/data/cities.ts`); this API just emits events.

## DO NOT
- Do NOT use "Chinese Mahjong" — always "Hong Kong Mahjong" in any event titles, descriptions, or response payloads. (Enforced by a PreToolUse hook.)
- Do NOT make breaking schema changes without updating both consumers in the same PR cycle.
- Do NOT commit `.env*` files, scraper credentials, or API keys.

## Code Task Queue (auto-synced from Notion)

At session start, read `~/Desktop/CLAUDE/Operations/code-queue.md` for pending Notion tasks assigned to Code. Refreshed by cron 6x/day. If stale (>4h), run `node ~/Desktop/CLAUDE/Operations/sync-code-queue.js`. If tasks exist, present to Nidhi and ask which to work on.

---

## Command Center logging — REQUIRED at end of every task

After completing any non-trivial task in this repo, log it to the Lucky Media Command Center so the work shows up in the executive brief at https://social-dashboard-delta-one.vercel.app and in the weekly scorecard:

```bash
node ~/Desktop/CLAUDE/Operations/log-to-command-center.js \
  --brand MAHJ \
  --type <feature_shipped|bug_fix|page_deployed|content_draft|automation_run|infrastructure|seo_check|audit|other> \
  --title "Short imperative title" \
  --summary "What changed and why, in 1-3 sentences" \
  --status completed \
  --repo luckyduck33/mahjmahj-api \
  --commit $(git rev-parse --short HEAD 2>/dev/null || echo '')
```

Add `--requires-review true` if Nidhi needs to look at it. Add `--monetization-related true` for affiliate/revenue/email work. Add `--seo-geo-related true` for indexing/schema/LLM-citation work. Run with `--help` for the full flag list.

The Command Center is the source of truth for what Code, ChatGPT, Cowork, and Opus have shipped. Skip the log only for: typo fixes, README tweaks, work-in-progress commits that you'll roll up into a single later log.
