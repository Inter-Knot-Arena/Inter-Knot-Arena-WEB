# Inter-Knot Arena

Inter-Knot Arena is a competitive platform for Zenless Zone Zero custom rulesets.
This repository is the production-ready web/backend baseline without the desktop Verifier app.

## What is implemented

- Web platform for profiles, matchmaking, draft, disputes, leaderboards, admin, and analytics.
- API with match state machine, moderation flow, sanctions lifecycle, audit log, and idempotent writes.
- Role model based on `MODER`, `STAFF`, `ADMIN` (no judge role model in product APIs/UI).
- Profile summary and analytics endpoints (history, top agents, draft/evidence aggregates).
- BO1 + full BO3 draft templates with timeout auto-pick/auto-ban and trust penalties.
- Enka showcase import with graceful degraded mode (`SUCCESS`, `DEGRADED`, `FAILED`) and snapshot fallback.
- Evidence upload in both S3 and local storage modes with validation, rate limits, and retention sweep.
- Realtime match room updates via SSE with polling fallback on web.
- CI checks for typecheck, API tests, and workspace builds.

## Monorepo layout

- `apps/api` - Fastify API, in-memory or Postgres repository, moderation and lifecycle services
- `apps/web` - React + Vite web application
- `packages/shared` - shared types, draft templates, and rules utilities
- `docs/RUNBOOK.md` - local/prod operating instructions
- `docs/RELEASE_NOTES.md` - release-level change log

## Quick start (PowerShell, local)

1. Install dependencies

```powershell
npm install
```

2. Start Postgres (optional but recommended for realistic state)

```powershell
docker start ika-postgres
$env:DATABASE_URL = "postgres://ika:ika@localhost:5433/inter_knot"
npm --workspace apps/api run db:migrate
npm --workspace apps/api run db:seed
```

3. Start API

```powershell
$env:DATABASE_URL = "postgres://ika:ika@localhost:5433/inter_knot"
$env:SESSION_SECRET = "change-me"
$env:WEB_ORIGIN = "http://localhost:5173"
$env:API_ORIGIN = "http://localhost:4000"

$env:ENABLE_AGENT_CATALOG = "true"
$env:ENABLE_ENKA_IMPORT = "true"
$env:ENABLE_ACCUMULATIVE_IMPORT = "true"
$env:ENKA_STORE_RAW = "true"
$env:ENKA_BASE_URL = "https://enka.network/api/zzz/uid"
$env:CACHE_TTL_MS = "600000"
$env:ENKA_RATE_LIMIT_MS = "30000"
$env:ENKA_TIMEOUT_MS = "8000"
$env:ENKA_RAW_TTL_SEC = "1209600"

# Storage mode: local fallback (no S3 required)
$env:IKA_STORAGE = "local"
$env:LOCAL_STORAGE_DIR = ".ika-storage"

npm run dev:api
```

4. Start web app (second terminal)

```powershell
$env:VITE_ENABLE_AGENT_CATALOG = "true"
$env:VITE_ENABLE_ENKA_IMPORT = "true"
npm run dev:web
```

The web app uses `/api` proxy to `http://localhost:4000` by default.

## Auth modes

- Normal mode: Google OAuth session cookies (`/auth/google/start`).
- Dev fallback: `AUTH_DISABLED=true` returns seed identity for quick local workflows.

Required OAuth envs for normal mode:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Storage modes

### Local storage (default fallback)

- `IKA_STORAGE=local`
- `LOCAL_STORAGE_DIR` (optional, defaults to `.ika-storage`)
- API exposes local upload/read routes under `/uploads/local/:encodedKey`.

### S3-compatible storage

- `IKA_STORAGE=s3`
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- optional: `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL`, `S3_PRESIGN_EXPIRES_SEC`

## Key API endpoints

### Profiles

- `GET /profiles/:id`
- `GET /profiles/:id/matches`
- `GET /profiles/:id/analytics`

### Match and realtime

- `POST /matchmaking/search`
- `GET /matchmaking/status/:ticketId`
- `GET /matches/:id`
- `GET /matches/:id/events` (SSE stream)

### Roster and Enka

- `GET /players/:uid/roster`
- `POST /players/:uid/import/enka`
- `POST /players/:uid/roster/manual`

### Moderation and sanctions

- `GET /disputes/queue`
- `POST /disputes/:id/decision`
- `GET /admin/sanctions`
- `POST /admin/sanctions`
- `PATCH /admin/sanctions/:id`
- `GET /admin/audit`

### Ops

- `GET /health`
- `GET /metrics` (includes Enka import telemetry snapshot)

## Quality gates

- `npm run typecheck`
- `npm --workspace apps/api run test`
- `npm run build:shared`
- `npm run build:api`
- `npm run build:web`

CI runs these checks on push.

## Notes

- Ranked queues rely on verification status and roster eligibility checks.
- Desktop Verifier app is intentionally out of scope in this codebase.
- Enka import always has a recovery path: degraded response with retry hints and manual roster fallback.
