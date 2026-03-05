# Pest Intel Backend (v1 scaffold)

Simple MVP backend for lead capture and triage queue.

## Run locally

```bash
cd backend
npm install
npm run dev
```

API:
- `GET /health`
- `POST /api/leads`
- `GET /api/leads`
- `POST /api/triage`
- `GET /api/triage`

Data is stored in JSON files under `backend/data/`.

## Next production step
Move storage to Postgres (Supabase/Neon), add auth, and role-based access.
