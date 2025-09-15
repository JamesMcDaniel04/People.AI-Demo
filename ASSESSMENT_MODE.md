Assessment Mode (Lightweight Den Clone)

Overview

This repo includes a lightweight, self-contained flow that satisfies the technical assessment requirements using sample data and in-memory scheduling, with optional mock distribution to Slack/Email/CRM. It is optimized for demos without external dependencies.

What’s included

- Synthetic data generator fallback for any account name
- Sample data that covers assessment counts (emails, calls, personas)
- AI plan generation (with safe fallbacks if API keys are not set)
- Automated workflow distribution (Slack summary, Email executive report)
- Scheduling via in-memory Cron (no Redis required)

Quick Start

1) Copy `.env.example` to `.env` and keep these lightweight defaults:
- `DATA_SOURCE=sample`
- `BULLMQ_ENABLED=false` (uses Cron fallback; no Redis needed)
- `GRAPHRAG_ENABLED=false` (optional)
- `ASSESSMENT_PRELOAD=true` (auto-creates schedules on server start)

2) Start the workflow server:
- `npm run workflow`

This will start the API and, with `ASSESSMENT_PRELOAD=true`, auto-register:
- Daily Account Health (summary to Slack) at 09:00
- Weekly Executive Report (email) on Mondays at 08:00

Optional helpers

- Reset demo state: `npm run demo:reset`
- Validate sample data: `npm run demo:seed`
- Warm server health: `npm run demo:warm`
- Dataset viewer: open `/dataset` or `public/dataset.html`
- Metrics snapshot: GET `/metrics` (timings include p95 per endpoint)

3) One-shot account plan (via API):
- `POST http://localhost:3001/quick/account-plan`
  Body example:
  {
    "accountName": "contoso",
    "distributors": [
      { "type": "slack", "config": { "channels": [{"channel": "#account-planning"}], "format": "summary" } },
      { "type": "email", "config": { "recipients": [{"email": "demo@example.com"}], "template": "executive" } }
    ]
  }

Notes

- Sample provider now generates synthetic data if a requested account isn’t present in the static JSON, meeting the requirement to generate fake/demo data for particular accounts.
- Slack, Email, and CRM distributors all support “mock mode” if credentials are not set — ideal for demos.
- For a News API (external data) demo, set `EXTERNAL_API_ENABLED=true` and provide `EXTERNAL_API_BASE_URL` and `EXTERNAL_API_KEY`. The system will enrich the sample core with news items.

Endpoints to Explore

- `GET /health` — server health
- `GET /templates` — built-in templates
- `POST /quick/account-plan` — generate + distribute a plan in one call
- `GET /integration/status` — current provider integrations and statuses
 - `GET /metrics` — counters + latency P50/P90/P95/P99
 - `GET /data/:account/summary` — dataset counts for emails/calls/stakeholders/external
 - `POST /external/sync` — pull external enrichment for an account
