import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RankBand, Ruleset, Sanction, Season, User } from "@ika/shared";
import type { Repository } from "../repository/types.js";
import type { AuthContext } from "../auth/context.js";
import { getAuthUser } from "../auth/context.js";
import { createId, now, requireString } from "../utils.js";
import type { ModerationStore } from "../moderation/types.js";
import type { AuditStore } from "../audit/types.js";

function sendError(reply: FastifyReply, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

function canModerate(user: User): boolean {
  return user.roles.includes("MODER") || user.roles.includes("STAFF") || user.roles.includes("ADMIN");
}

function isAdmin(user: User): boolean {
  return user.roles.includes("STAFF") || user.roles.includes("ADMIN");
}

async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  repo: Repository,
  auth: AuthContext
): Promise<User | null> {
  const user = await getAuthUser(request, repo, auth);
  if (!user) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }
  return user;
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  repo: Repository,
  moderation: ModerationStore,
  audit: AuditStore,
  auth: AuthContext
) {
  app.get("/admin/rulesets", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!canModerate(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
      reply.send(await repo.listRulesets());
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.put("/admin/rulesets/:id", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!isAdmin(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }

      const rulesetId = requireString((request.params as { id?: string }).id, "rulesetId");
      const body = request.body as Partial<Ruleset>;
      const existing = await repo.findRuleset(rulesetId);
      const payload: Ruleset = {
        ...existing,
        ...body,
        id: rulesetId
      };
      const saved = await repo.saveRuleset(payload);
      await audit.record({
        actorUserId: user.id,
        action: "ADMIN_RULESET_SAVE",
        entityType: "RULESET",
        entityId: rulesetId,
        payload
      });
      reply.send(saved);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/admin/seasons", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!canModerate(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
      reply.send(await repo.listSeasons());
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.put("/admin/seasons/:id", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!isAdmin(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }

      const seasonId = requireString((request.params as { id?: string }).id, "seasonId");
      const body = request.body as Partial<Season>;
      const existing = (await repo.listSeasons()).find((season) => season.id === seasonId);
      const payload: Season = {
        ...(existing ?? {
          id: seasonId,
          name: body.name ?? seasonId,
          status: "PLANNED",
          startsAt: now(),
          endsAt: now() + 30 * 24 * 60 * 60 * 1000
        }),
        ...body,
        id: seasonId
      };
      const saved = await repo.saveSeason(payload);
      await audit.record({
        actorUserId: user.id,
        action: "ADMIN_SEASON_SAVE",
        entityType: "SEASON",
        entityId: seasonId,
        payload
      });
      reply.send(saved);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/admin/rank-bands", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!canModerate(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
      reply.send(await moderation.listRankBands());
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.put("/admin/rank-bands", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!isAdmin(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
      const body = request.body as { bands?: RankBand[] };
      const bands = body.bands ?? [];
      const saved = await moderation.saveRankBands(bands);
      await audit.record({
        actorUserId: user.id,
        action: "ADMIN_RANK_BANDS_SAVE",
        entityType: "RANK_BAND",
        payload: { count: saved.length }
      });
      reply.send(saved);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/admin/sanctions", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!canModerate(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
      const query = request.query as { limit?: string };
      const limitRaw = Number(query.limit ?? 100);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
      reply.send(await moderation.listSanctions(limit));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/admin/sanctions", async (request, reply) => {
    try {
      const user = await requireUser(request, reply, repo, auth);
      if (!user) {
        return;
      }
      if (!canModerate(user)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
      const body = request.body as Partial<Sanction>;
      const targetUserId = requireString(body.userId, "userId");
      await repo.findUser(targetUserId);

      const sanction: Sanction = {
        id: body.id ?? createId("sanction"),
        userId: targetUserId,
        type: (body.type ?? "WARNING") as Sanction["type"],
        status: (body.status ?? "ACTIVE") as Sanction["status"],
        reason: requireString(body.reason, "reason"),
        issuedBy: user.id,
        matchId: body.matchId,
        metadata: body.metadata,
        createdAt: body.createdAt ?? now(),
        expiresAt: body.expiresAt
      };
      const saved = await moderation.saveSanction(sanction);
      await audit.record({
        actorUserId: user.id,
        action: "ADMIN_SANCTION_SAVE",
        entityType: "SANCTION",
        entityId: saved.id,
        payload: saved
      });
      reply.code(201).send(saved);
    } catch (error) {
      sendError(reply, error);
    }
  });
}
