# Inter-Knot Arena

Competitive platform skeleton based on `AGENTS.md`. This repo contains a shared types package, a Fastify API with in-memory state, and a React web UI shell.

## Workspace layout

- `apps/api`: REST API (Fastify, in-memory store, seed data)
- `apps/web`: Web UI (React + Vite)
- `packages/shared`: Shared types and utilities

## Quick start

1) Install dependencies

```bash
npm install
```

2) Run the API

```bash
npm run dev:api
```

3) Run the web app

```bash
npm run dev:web
```

The web app expects the API at `http://localhost:4000`. Vite proxies `/api` to the API by default.

## Scripts

- `npm run dev:api`: start API dev server
- `npm run dev:web`: start web dev server
- `npm run build:shared`: build shared package
- `npm run build:api`: build API
- `npm run build:web`: build web UI
- `npm run typecheck`: typecheck all workspaces

## Notes

- API data is stored in memory and resets on restart.
- The Verifier app is not implemented yet; the API exposes placeholders for verifier sessions and evidence uploads.
- Refer to `AGENTS.md` for the full specification and acceptance criteria.
