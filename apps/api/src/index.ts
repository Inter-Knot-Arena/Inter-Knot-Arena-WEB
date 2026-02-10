import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { registerRoutes } from "./routes.js";
import { createRepository } from "./repository/index.js";
import { createStorage } from "./storage/index.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerIdentityRoutes } from "./routes/identity.js";
import { createAuthContext } from "./auth/context.js";
import { getFeatureFlags } from "./featureFlags.js";
import { createCatalogStore } from "./catalog/store.js";
import { createCache } from "./cache/index.js";
import { createRosterStore } from "./roster/index.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerRosterRoutes } from "./routes/roster.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? true,
  credentials: true
});
await app.register(cookie);

const repo = await createRepository();
const storage = createStorage();
const auth = createAuthContext(repo);
const flags = getFeatureFlags();
await registerAuthRoutes(app, repo, auth);
await registerUserRoutes(app, repo, auth);
await registerIdentityRoutes(app, repo, auth);
await registerRoutes(app, repo, storage, auth);

if (flags.enableAgentCatalog || flags.enableEnkaImport) {
  const catalogStore = await createCatalogStore();
  if (flags.enableAgentCatalog) {
    await registerCatalogRoutes(app, catalogStore, repo, auth);
  }
  if (flags.enableEnkaImport) {
    const { client, config } = createCache();
    const rosterStore = await createRosterStore();
    await registerRosterRoutes(app, repo, catalogStore, rosterStore, client, config.ttlMs, auth);
  }
}

setInterval(() => {
  void auth.sessionStore.purgeExpired();
}, 60_000).unref();

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
