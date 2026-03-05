# Pest Intel Backend (v1)

MVP backend for lead capture + triage workflow.

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

Admin (`x-admin-key` required):
- `GET /api/leads`
- `GET /api/triage`
- `PATCH /api/triage/:id`
- `GET /api/dashboard/summary`

## Data storage
- JSON files in `backend/data/` (`leads.json`, `triage.json`)

## Next production step
- Move data layer to Postgres (Supabase/Neon)
- Add auth/session UI for admin portal
- Add webhook notifications to Telegram for high-priority triage
