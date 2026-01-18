# Inter-Knot Arena

Competitive platform skeleton based on `AGENTS.md`. This repo contains a shared types package, a Fastify API with in-memory state (or Postgres), and a React web UI shell.

## Workspace layout

- `apps/api`: REST API (Fastify, in-memory or Postgres storage, seed data)
- `apps/web`: Web UI (React + Vite)
- `packages/shared`: Shared types and utilities

## Quick start

1. Install dependencies

```bash
npm install
```

2. Run the API

```bash
npm run dev:api
```

3. Run the web app (separate terminal)

```bash
npm run dev:web
```

The web app expects the API at `http://localhost:4000`. Vite proxies `/api` to the API by default.

## Auth (Google OAuth)

The API implements Google OAuth 2.0 Authorization Code + PKCE and stores sessions in httpOnly cookies.

### Quick dev mode (no Google)

Set `AUTH_DISABLED=true` on the API. `/auth/me` will return the first seed user.

```bash
setx AUTH_DISABLED "true"
```

### Google OAuth setup

Required environment variables (API):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (default: `${API_ORIGIN}/auth/google/callback`)
- `SESSION_SECRET` (random string)
- `WEB_ORIGIN` (default: `http://localhost:5173`)
- `API_ORIGIN` (default: `http://localhost:4000`)
Optional:

- `SESSION_TTL_DAYS` (default 7)
- `AUTH_STATE_TTL_SEC` (default 600)
- `PASSWORD_MIN_LENGTH` (default 8)

Example (PowerShell):

```powershell
$env:GOOGLE_CLIENT_ID = "..."
$env:GOOGLE_CLIENT_SECRET = "..."
$env:GOOGLE_REDIRECT_URI = "http://localhost:4000/auth/google/callback"
$env:SESSION_SECRET = "change-me"
$env:WEB_ORIGIN = "http://localhost:5173"
$env:API_ORIGIN = "http://localhost:4000"
```

If your web app is not using the Vite proxy, set `VITE_API_URL` in `apps/web` to your API origin.

## Postgres

The API uses the in-memory repository by default. To use Postgres, set `DATABASE_URL` and run migrations + seed data.

```bash
export DATABASE_URL="postgres://user:pass@localhost:5432/inter_knot"
npm --workspace apps/api run db:migrate
npm --workspace apps/api run db:seed
npm run dev:api
```

You can also force the in-memory repository by setting `IKA_REPOSITORY=memory`.

## Storage (S3-compatible)

The API can generate pre-signed upload URLs for S3-compatible storage.

Required environment variables:

- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Optional:

- `S3_ENDPOINT` (for MinIO/other S3-compatible providers)
- `S3_FORCE_PATH_STYLE=true`
- `S3_PUBLIC_URL` (base public URL or CDN origin)
- `S3_PRESIGN_EXPIRES_SEC` (default 900)
- `IKA_STORAGE=s3` (force S3 storage)

Example:

```bash
export IKA_STORAGE=s3
export S3_BUCKET="ika-prod"
export S3_REGION="us-east-1"
export S3_ACCESS_KEY_ID="..."
export S3_SECRET_ACCESS_KEY="..."
export S3_ENDPOINT="https://s3.example.com"
export S3_FORCE_PATH_STYLE=true
export S3_PUBLIC_URL="https://cdn.example.com/ika"
```

Use `POST /uploads/presign` to get a pre-signed PUT URL.

## Scripts

- `npm run dev:api`: start API dev server
- `npm run dev:web`: start web dev server
- `npm run build:shared`: build shared package
- `npm run build:api`: build API
- `npm run build:web`: build web UI
- `npm run typecheck`: typecheck all workspaces
- `npm --workspace apps/api run db:migrate`: run Postgres schema
- `npm --workspace apps/api run db:seed`: seed Postgres with base data

## Notes

- API data is stored in memory and resets on restart unless Postgres is configured.
- The Verifier app is not implemented yet; the API exposes placeholders for verifier sessions and evidence uploads.
