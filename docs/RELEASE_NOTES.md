# Release Notes

## 2026-02 Production Baseline (No Verifier App)

### Platform scope

- Delivered production-ready web + API baseline without desktop Verifier app.
- Moderation model standardized to `MODER`, `STAFF`, `ADMIN`.

### Profile and UX consistency

- Unified UID verification status rendering across profile/settings/matchmaking/uid flows.
- Removed self-targeting action leaks (challenge/report not shown on self profile).
- Stabilized profile and roster layouts for desktop/mobile widths.
- Removed remaining UI text artifacts and inconsistent labels.

### Profile API expansion

- Expanded `GET /profiles/:id` with analytics-ready summary shape.
- Added:
  - `GET /profiles/:id/matches`
  - `GET /profiles/:id/analytics`
- Added shared contracts for profile analytics and paginated history.

### Moderation and sanctions

- Added sanction lifecycle updates via `PATCH /admin/sanctions/:id`.
- Enforced active sanctions in matchmaking queue/search entry points.
- Added moderation audit coverage for dispute and sanction operations.

### Draft and match completeness

- Implemented full BO3 draft sequence (not BO1 duplicate).
- Improved timeout behavior with deterministic auto-draft ordering and trust penalties.

### Evidence and storage

- Added local storage fallback implementation for uploads and reads.
- Added upload validation:
  - content type checks
  - max payload size checks
  - upload rate limiting
- Added evidence retention sweep/redaction behavior in lifecycle processing.

### Enka degraded mode

- `POST /players/:uid/import/enka` now returns structured outcomes:
  - `SUCCESS`
  - `DEGRADED` with `retryAfterSec`, `usedSnapshotAt`
  - `FAILED` with retry hints
- Added fallback to latest valid snapshot when Enka is unavailable.
- Added Enka import telemetry (latency, status counts, error buckets) exposed under `/metrics`.

### Realtime and CI

- Added SSE endpoint `GET /matches/:id/events` with web fallback polling.
- Extended CI with build jobs for shared/api/web in addition to typecheck/tests.

### Test coverage additions

- BO3 draft template progression tests.
- Profile privacy/history service tests.
- Enka metrics aggregation/error classification tests.

### Operational docs

- README updated to current production baseline behavior.
- Added runbook: `docs/RUNBOOK.md`.
