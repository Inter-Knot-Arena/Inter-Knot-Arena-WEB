import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { DraftActionType, EvidenceRecord, EvidenceResult, ResultProof, User } from "@ika/shared";
import type { Repository } from "./repository/types.js";
import type { StorageClient } from "./storage/types.js";
import {
  applyDraftAction,
  confirmMatch,
  createMatchFromQueue,
  markCheckin,
  openDispute,
  recordInrun,
  recordPrecheck,
  recordResult,
  resolveDispute
} from "./services/matchService.js";
import {
  cancelMatchmaking,
  getLobbyStats,
  getMatchmakingStatus,
  searchMatch
} from "./services/matchmakingService.js";
import { createId, now, requireArray, requireString } from "./utils.js";
import { getAuthUser, type AuthContext } from "./auth/context.js";

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  if (error instanceof HttpError) {
    reply.code(error.status).send({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

function isModerator(user: User): boolean {
  return user.roles.includes("MODER") || user.roles.includes("STAFF") || user.roles.includes("ADMIN");
}

function assertParticipant(user: User, match: { players: Array<{ userId: string }> }): void {
  const isParticipant = match.players.some((player) => player.userId === user.id);
  if (!isParticipant && !isModerator(user)) {
    throw new HttpError(403, "Forbidden");
  }
}

async function requireAuthUser(
  request: FastifyRequest,
  repo: Repository,
  auth: AuthContext
): Promise<User> {
  const user = await getAuthUser(request, repo, auth);
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  return user;
}

export async function registerRoutes(
  app: FastifyInstance,
  repo: Repository,
  storage: StorageClient,
  auth: AuthContext
) {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/matchmaking/lobbies", async (request, reply) => {
    try {
      reply.send(await getLobbyStats(repo));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/uploads/presign", async (request, reply) => {
    try {
      await requireAuthUser(request, repo, auth);
      const body = request.body as {
        purpose?: string;
        contentType?: string;
        extension?: string;
      };
      const key = buildUploadKey(body?.purpose, body?.extension);
      const presign = await storage.getPresignedUpload({
        key,
        contentType: body?.contentType
      });
      reply.send(presign);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/agents", async () => repo.listAgents());
  app.get("/leagues", async () => repo.listLeagues());
  app.get("/rulesets", async () => repo.listRulesets());
  app.get("/challenges", async () => repo.listChallenges());
  app.get("/queues", async () => repo.listQueues());
  app.get("/seasons/current", async () => repo.getActiveSeason());
  app.get("/leaderboards/:leagueId", async (request, reply) => {
    try {
      const leagueId = requireString((request.params as { leagueId?: string }).leagueId, "leagueId");
      const ratings = await repo.listLeaderboard(leagueId);
      reply.send({ leagueId, ratings });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matchmaking/join", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const body = request.body as { queueId?: string };
      const queueId = requireString(body?.queueId, "queueId");
      const match = await createMatchFromQueue(repo, queueId, user.id);
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matchmaking/search", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const body = request.body as { queueId?: string };
      const queueId = requireString(body?.queueId, "queueId");
      const result = await searchMatch(repo, queueId, user.id);
      reply.send(result);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/matchmaking/status/:ticketId", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const ticketId = requireString(
        (request.params as { ticketId?: string }).ticketId,
        "ticketId"
      );
      const ticket = await repo.findMatchmakingEntry(ticketId);
      if (ticket.userId !== user.id && !isModerator(user)) {
        throw new HttpError(403, "Forbidden");
      }
      const result = await getMatchmakingStatus(repo, ticketId);
      reply.send(result);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matchmaking/cancel", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const body = request.body as { ticketId?: string };
      const ticketId = requireString(body?.ticketId, "ticketId");
      const ticket = await repo.findMatchmakingEntry(ticketId);
      if (ticket.userId !== user.id && !isModerator(user)) {
        throw new HttpError(403, "Forbidden");
      }
      const result = await cancelMatchmaking(repo, ticketId);
      reply.send(result);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/matches/:id", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/checkin", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      reply.send(await markCheckin(repo, matchId, user.id));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/draft/action", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const body = request.body as {
        type?: DraftActionType;
        agentId?: string;
      };
      const type = requireString(body?.type, "type") as DraftActionType;
      const agentId = requireString(body?.agentId, "agentId");
      const updated = await applyDraftAction(repo, matchId, { type, agentId, userId: user.id, timestamp: now() });
      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/evidence/precheck", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const body = request.body as {
        detectedAgents?: string[];
        confidence?: Record<string, number>;
        result?: EvidenceResult;
        frameHash?: string;
        cropUrl?: string;
      };
      const record: EvidenceRecord = {
        id: createId("ev"),
        type: "PRECHECK",
        timestamp: now(),
        userId: user.id,
        detectedAgents: requireArray<string>(body?.detectedAgents, "detectedAgents"),
        confidence: body?.confidence ?? {},
        result: (body?.result ?? "LOW_CONF") as EvidenceResult,
        frameHash: body?.frameHash,
        cropUrl: body?.cropUrl
      };
      const updated = await recordPrecheck(repo, matchId, record);
      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/evidence/inrun", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const body = request.body as {
        detectedAgents?: string[];
        confidence?: Record<string, number>;
        result?: EvidenceResult;
        frameHash?: string;
        cropUrl?: string;
      };
      const record: EvidenceRecord = {
        id: createId("ev"),
        type: "INRUN",
        timestamp: now(),
        userId: user.id,
        detectedAgents: requireArray<string>(body?.detectedAgents, "detectedAgents"),
        confidence: body?.confidence ?? {},
        result: (body?.result ?? "LOW_CONF") as EvidenceResult,
        frameHash: body?.frameHash,
        cropUrl: body?.cropUrl
      };
      const updated = await recordInrun(repo, matchId, record);
      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/result/submit", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const body = request.body as {
        metricType?: string;
        value?: number | string;
        proofUrl?: string;
        demoUrl?: string;
        notes?: string;
      };
      const metricType = requireString(body?.metricType, "metricType") as "TIME_MS" | "SCORE" | "RANK_TIER";
      const value = body?.value ?? 0;
      const proofUrl = requireString(body?.proofUrl, "proofUrl");
      const submittedAt = now();
      const payload: ResultProof = {
        metricType,
        submittedAt,
        userId: user.id,
        value,
        proofUrl,
        entries: [
          {
            userId: user.id,
            value,
            proofUrl,
            demoUrl: body?.demoUrl,
            submittedAt
          }
        ],
        notes: body?.notes
      };
      const updated = await recordResult(repo, matchId, payload);
      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/confirm", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const updated = await confirmMatch(repo, matchId, user.id);
      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/dispute/open", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const body = request.body as { reason?: string; evidenceUrls?: string[] };
      const reason = requireString(body?.reason, "reason");
      const evidenceUrls = body?.evidenceUrls?.filter((item) => typeof item === "string");
      const dispute = await openDispute(repo, matchId, user.id, reason, evidenceUrls);
      reply.send(dispute);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/disputes/queue", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      if (!isModerator(user)) {
        throw new HttpError(403, "Forbidden");
      }
      reply.send(await repo.listOpenDisputes());
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/disputes/:id/decision", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      if (!isModerator(user)) {
        throw new HttpError(403, "Forbidden");
      }
      const disputeId = requireString((request.params as { id?: string }).id, "disputeId");
      const body = request.body as { decision?: string; winnerUserId?: string };
      const dispute = await resolveDispute(
        repo,
        disputeId,
        requireString(body?.decision, "decision"),
        user.id,
        body?.winnerUserId
      );
      reply.send(dispute);
    } catch (error) {
      sendError(reply, error);
    }
  });
}

function buildUploadKey(purpose?: string, extension?: string): string {
  const safePurpose = sanitizeSegment(purpose ?? "uploads");
  const safeExtension = sanitizeExtension(extension);
  return `${safePurpose}/${createId("obj")}${safeExtension}`;
}

function sanitizeSegment(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "uploads";
}

function sanitizeExtension(value?: string): string {
  if (!value) {
    return "";
  }
  const cleaned = value.toLowerCase().replace(/^\./, "").replace(/[^a-z0-9]/g, "");
  return cleaned ? `.${cleaned}` : "";
}
