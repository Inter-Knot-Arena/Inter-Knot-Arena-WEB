import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes";
import { createRepository } from "./repository";
import { createStorage } from "./storage";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

const repo = await createRepository();
const storage = createStorage();
await registerRoutes(app, repo, storage);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
