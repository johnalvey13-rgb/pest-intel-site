# Pest Intel Backend (v1)

MVP backend for lead capture + triage + client activity logging.

## Run

```bash
cd backend
npm install
ADMIN_KEY='change-me' ALLOWED_ORIGIN='https://pest-intel-site.vercel.app' npm start
```

## Endpoints

Public:
- `GET /health`
- `POST /api/leads`
- `POST /api/triage`
- `POST /api/activity` (client activity logging)
- `POST /api/sites/setup` (site + monitoring points setup)
- `GET /api/sites/:siteName/monitoring-points`
- `POST /api/onboarding-assessment` (simple-language risk walkthrough)
- `GET /api/onboarding-assessment/:siteName`

Admin (`x-admin-key` required):
- `GET /api/leads`
- `GET /api/triage`
- `PATCH /api/triage/:id`
- `GET /api/activity`
- `GET /api/sites`
- `GET /api/onboarding-assessments`
- `GET /api/workflow-events`
- `GET /api/dashboard/summary`

## Current automation
- Site setup stores named monitoring points so repeat visits can reuse them.
- Activity logs can reference monitoring points; unknown points are auto-added to that site.
- Onboarding assessment returns staged risk output (green/amber/red) with action plan.
- Activity logs auto-create triage cases when trigger findings are detected:
  - droppings
  - gnaw damage
  - bait consumption / bait take
  - trap activation
  - multiple insect sightings
  - smear marks
- Workflow events are recorded for lead/triage/activity/site/onboarding actions.

## Data storage
JSON files in `backend/data/`:
- `leads.json`
- `triage.json`
- `activity.json`
- `sites.json`
- `onboarding-assessments.json`
- `workflow-events.json`

## Next production step
- Move data layer to Postgres (Supabase/Neon)
- Add proper auth (client + staff roles)
- Add Telegram alert hooks for urgent triage
- Build client app screens against these endpoints
