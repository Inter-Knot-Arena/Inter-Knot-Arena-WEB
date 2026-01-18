import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { registerRoutes } from "./routes.js";
import { createRepository } from "./repository/index.js";
import { createStorage } from "./storage/index.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerUserRoutes } from "./routes/users.js";
import { createAuthContext } from "./auth/context.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? true,
  credentials: true
});
await app.register(cookie);

const repo = await createRepository();
const storage = createStorage();
const auth = createAuthContext();
await registerAuthRoutes(app, repo, auth);
await registerUserRoutes(app, repo, auth);
await registerRoutes(app, repo, storage);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
