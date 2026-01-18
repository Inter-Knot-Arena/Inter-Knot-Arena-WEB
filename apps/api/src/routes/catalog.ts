import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types.js";
import type { CatalogStore } from "../catalog/store.js";
import { getAuthUser, type AuthContext } from "../auth/context.js";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

export async function registerCatalogRoutes(
  app: FastifyInstance,
  catalog: CatalogStore,
  repo: Repository,
  auth: AuthContext
) {
  app.get("/catalog/agents", async () => catalog.getCatalog());

  app.post("/admin/catalog/reload", async (request, reply) => {
    try {
      if (process.env.NODE_ENV === "production") {
        reply.code(404).send({ error: "Not available" });
        return;
      }

      if (!auth.config.authDisabled) {
        const user = await getAuthUser(request, repo, auth);
        if (!user || !user.roles.includes("ADMIN")) {
          reply.code(403).send({ error: "Forbidden" });
          return;
        }
      }

      const result = await catalog.reload();
      reply.send(result);
    } catch (error) {
      sendError(reply, error);
    }
  });
}
