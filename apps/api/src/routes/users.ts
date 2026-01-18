import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types";
import type { Region, User } from "@ika/shared";
import { getProfileSummary } from "../services/profileService";
import { now, requireString } from "../utils";
import { getAuthUser, type AuthContext } from "../auth/context";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

const REGIONS: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];

function isValidRegion(value: string | undefined): value is Region {
  return Boolean(value && REGIONS.includes(value as Region));
}

function isValidUrl(value: string): boolean {
  if (value.startsWith("data:image/")) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function registerUserRoutes(
  app: FastifyInstance,
  repo: Repository,
  auth: AuthContext
) {
  app.get("/users", async () => repo.listUsers());

  app.get("/users/:id", async (request, reply) => {
    try {
      const userId = requireString((request.params as { id?: string }).id, "userId");
      reply.send(await repo.findUser(userId));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/profiles/:id", async (request, reply) => {
    try {
      const userId = requireString((request.params as { id?: string }).id, "userId");
      reply.send(await getProfileSummary(repo, userId));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.patch("/users/me", async (request, reply) => {
    try {
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      const body = request.body as {
        displayName?: string;
        region?: string;
        avatarUrl?: string | null;
        privacy?: { showUidPublicly?: boolean; showMatchHistoryPublicly?: boolean };
      };

      if (body.displayName !== undefined) {
        const name = requireString(body.displayName, "displayName");
        if (name.length > 24) {
          throw new Error("displayName must be 24 characters or fewer");
        }
      }

      if (body.region !== undefined && !isValidRegion(body.region)) {
        throw new Error("Invalid region");
      }

      if (body.avatarUrl !== undefined && body.avatarUrl !== null && !isValidUrl(body.avatarUrl)) {
        throw new Error("avatarUrl must be a valid URL");
      }

      const updated: User = {
        ...user,
        displayName: body.displayName ?? user.displayName,
        region: body.region ? (body.region as Region) : user.region,
        avatarUrl: body.avatarUrl === undefined ? user.avatarUrl : body.avatarUrl,
        privacy: {
          showUidPublicly: body.privacy?.showUidPublicly ?? user.privacy.showUidPublicly,
          showMatchHistoryPublicly:
            body.privacy?.showMatchHistoryPublicly ?? user.privacy.showMatchHistoryPublicly
        },
        updatedAt: now()
      };

      await repo.saveUser(updated);
      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/users/me/avatar", async (request, reply) => {
    try {
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      const body = request.body as { url?: string };
      const avatarUrl = requireString(body?.url, "url");
      if (!isValidUrl(avatarUrl)) {
        throw new Error("avatarUrl must be a valid URL");
      }
      const updated: User = {
        ...user,
        avatarUrl,
        updatedAt: now()
      };
      await repo.saveUser(updated);
      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });
}
