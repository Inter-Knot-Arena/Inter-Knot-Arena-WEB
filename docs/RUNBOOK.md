# Inter-Knot Arena Runbook

## Scope

Operational runbook for the production-ready baseline (web + API), excluding desktop Verifier app.

## 1. Environment matrix

### API core

- `PORT` (default `4000`)
- `HOST` (default `0.0.0.0`)
- `WEB_ORIGIN` (default `http://localhost:5173`)
- `API_ORIGIN` (default `http://localhost:4000`)
- `SESSION_SECRET` (required for non-dev auth)
- `AUTH_DISABLED=true` (optional dev bypass)

### Repository mode

- `DATABASE_URL` set -> Postgres repository mode
- no `DATABASE_URL` -> memory repository mode
- `IKA_REPOSITORY=memory` forces memory mode

### Enka import

- `ENABLE_ENKA_IMPORT=true`
- `ENKA_BASE_URL` (default `https://enka.network/api/zzz/uid`)
- `CACHE_TTL_MS` (default `600000`)
- `ENKA_RATE_LIMIT_MS` (default `30000`)
- `ENKA_TIMEOUT_MS` (default `8000`)
- `ENABLE_ACCUMULATIVE_IMPORT=true`
- `ENKA_STORE_RAW=true|false`
- `ENKA_RAW_TTL_SEC` (default `1209600`)

### Storage mode

Local fallback:

- `IKA_STORAGE=local`
- `LOCAL_STORAGE_DIR` (default `.ika-storage`)
- `LOCAL_STORAGE_PUBLIC_BASE` (optional)

S3 mode:

- `IKA_STORAGE=s3`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- optional: `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL`, `S3_PRESIGN_EXPIRES_SEC`

### Feature flags

API:

- `ENABLE_AGENT_CATALOG=true`
- `ENABLE_ENKA_IMPORT=true`

Web:

- `VITE_ENABLE_AGENT_CATALOG=true`
- `VITE_ENABLE_ENKA_IMPORT=true`
- optional `VITE_API_URL`

## 2. Local startup checklist

1. `npm install`
2. Start DB (if Postgres mode), run migrations and seed:
   `npm --workspace apps/api run db:migrate`
   `npm --workspace apps/api run db:seed`
3. Start API: `npm run dev:api`
4. Start web: `npm run dev:web`
5. Smoke checks:
   - `GET /health` returns `{"status":"ok"}`
   - login works
   - profile page loads
   - matchmaking search creates ticket
   - roster import returns `SUCCESS|DEGRADED|FAILED`

## 3. Deploy checklist

1. Apply migrations before rollout.
2. Confirm storage mode envs are valid.
3. Confirm `WEB_ORIGIN`/`API_ORIGIN` CORS pair is correct.
4. Run quality gates:
   - `npm run typecheck`
   - `npm --workspace apps/api run test`
   - `npm run build:shared`
   - `npm run build:api`
   - `npm run build:web`
5. Verify `/health` and `/metrics` after deploy.

## 4. Enka degraded-mode operations

`POST /players/:uid/import/enka` always returns structured status:

- `SUCCESS` - import completed normally.
- `DEGRADED` - Enka failed, fallback snapshot used; inspect `retryAfterSec` and `usedSnapshotAt`.
- `FAILED` - no valid fallback snapshot; user should retry later or use manual roster.

Actions:

1. Check `/metrics.enka` for error buckets (`http403`, `http429`, `timeout`, `http5xx`).
2. If high failure rate, reduce import pressure or increase retry interval.
3. Keep manual roster path available so ranked flow is not globally blocked.

## 5. Evidence upload operations

1. `POST /uploads/presign` allocates upload destination.
2. Local mode:
   - upload goes to `/uploads/local/:encodedKey`
   - file served by `/uploads/local/:encodedKey`
3. S3 mode:
   - upload uses S3 pre-signed URL.

Guardrails:

- upload rate limit (`UPLOAD_RATE_WINDOW_MS`, `UPLOAD_RATE_MAX_REQUESTS`)
- payload max bytes (`UPLOAD_MAX_BYTES`)
- content type allow-list (`image/*`, `video/*`, `application/octet-stream`)

## 6. Scheduled jobs and lifecycle

- Match lifecycle sweep runs continuously (timeouts, transitions, auto-draft actions).
- Roster snapshot cleanup runs every 10 minutes.
- Evidence retention sweep runs on lifecycle interval and redacts/cleans data per ruleset policy.

## 7. Incident playbook

### Matchmaking blocked unexpectedly

1. Check active sanctions for affected user.
2. Verify queue and ruleset are enabled.
3. Inspect audit log for recent moderation actions.

### Realtime stream unavailable

1. Validate `GET /matches/:id/events` returns stream headers.
2. Check browser fallback polling still updates match state.

### CI regression

1. Re-run `npm run typecheck`.
2. Re-run `npm --workspace apps/api run test`.
3. Re-run workspace builds.
4. Identify failing commit by hash and rollback/patch.

## 8. Known limits

- Enka is third-party and may return 403/429 unpredictably.
- Current metrics are in-memory snapshots (reset on API restart).
- Web bundle chunk size warning remains and can be optimized later with code splitting.
