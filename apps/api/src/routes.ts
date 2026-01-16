import type { FastifyInstance } from "fastify";
import type { DraftActionType, EvidenceRecord, EvidenceResult } from "@ika/shared";
import type { Repository } from "./repository/types";
import type { StorageClient } from "./storage/types";
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
} from "./services/matchService";
import { getProfileSummary } from "./services/profileService";
import { createId, now, requireArray, requireString } from "./utils";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

export async function registerRoutes(
  app: FastifyInstance,
  repo: Repository,
  storage: StorageClient
) {
  app.get("/health", async () => ({ status: "ok" }));

  app.post("/uploads/presign", async (request, reply) => {
    try {
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
      const body = request.body as { userId?: string; queueId?: string };
      const userId = requireString(body?.userId, "userId");
      const queueId = requireString(body?.queueId, "queueId");
      const match = await createMatchFromQueue(repo, queueId, userId);
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/matches/:id", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      reply.send(await repo.findMatch(matchId));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/checkin", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const body = request.body as { userId?: string };
      const userId = requireString(body?.userId, "userId");
      const match = await markCheckin(repo, matchId, userId);
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/draft/action", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const body = request.body as {
        userId?: string;
        type?: DraftActionType;
        agentId?: string;
      };
      const userId = requireString(body?.userId, "userId");
      const type = requireString(body?.type, "type") as DraftActionType;
      const agentId = requireString(body?.agentId, "agentId");
      const match = await applyDraftAction(repo, matchId, { type, agentId, userId, timestamp: now() });
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/verifier/session", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      const ruleset = await repo.findRuleset(match.rulesetId);
      reply.send({
        sessionToken: createId("vsess"),
        nonce: createId("nonce"),
        privacyMode: ruleset.privacyMode,
        inrunFrequencySec: ruleset.inrunFrequencySec,
        requireInrunCheck: ruleset.requireInrunCheck
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/evidence/precheck", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const body = request.body as {
        userId?: string;
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
        userId: body?.userId,
        detectedAgents: requireArray<string>(body?.detectedAgents, "detectedAgents"),
        confidence: body?.confidence ?? {},
        result: (body?.result ?? "LOW_CONF") as EvidenceResult,
        frameHash: body?.frameHash,
        cropUrl: body?.cropUrl
      };
      const match = await recordPrecheck(repo, matchId, record);
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/evidence/inrun", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const body = request.body as {
        userId?: string;
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
        userId: body?.userId,
        detectedAgents: requireArray<string>(body?.detectedAgents, "detectedAgents"),
        confidence: body?.confidence ?? {},
        result: (body?.result ?? "LOW_CONF") as EvidenceResult,
        frameHash: body?.frameHash,
        cropUrl: body?.cropUrl
      };
      const match = await recordInrun(repo, matchId, record);
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/result/submit", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const body = request.body as {
        metricType?: string;
        value?: number | string;
        proofUrl?: string;
      };
      const match = await recordResult(repo, matchId, {
        metricType: requireString(body?.metricType, "metricType") as "TIME_MS" | "SCORE" | "RANK_TIER",
        value: body?.value ?? 0,
        proofUrl: requireString(body?.proofUrl, "proofUrl"),
        submittedAt: now()
      });
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/confirm", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const body = request.body as { userId?: string };
      const match = await confirmMatch(repo, matchId, requireString(body?.userId, "userId"));
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/dispute/open", async (request, reply) => {
    try {
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const body = request.body as { userId?: string; reason?: string };
      const dispute = await openDispute(
        repo,
        matchId,
        requireString(body?.userId, "userId"),
        requireString(body?.reason, "reason")
      );
      reply.send(dispute);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/disputes/queue", async () => {
    return repo.listOpenDisputes();
  });

  app.post("/disputes/:id/decision", async (request, reply) => {
    try {
      const disputeId = requireString((request.params as { id?: string }).id, "disputeId");
      const body = request.body as { decision?: string };
      const dispute = await resolveDispute(
        repo,
        disputeId,
        requireString(body?.decision, "decision")
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
