import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  DraftActionType,
  EvidenceRecord,
  EvidenceResult,
  Match,
  Region,
  ResultProof,
  User
} from "@ika/shared";
import type { Repository } from "./repository/types.js";
import type { StorageClient } from "./storage/types.js";
import type { PlayerAgentStateStore } from "./roster/types.js";
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
import {
  type MatchLifecycleConfig,
  runMatchLifecycle
} from "./services/matchLifecycleService.js";
import { createId, now, requireArray, requireString } from "./utils.js";
import { getAuthUser, type AuthContext } from "./auth/context.js";
import type { AuditStore } from "./audit/types.js";
import type { IdempotencyStore } from "./idempotency/types.js";
import type { ModerationStore } from "./moderation/types.js";

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
  auth: AuthContext,
  lifecycleConfig: MatchLifecycleConfig,
  audit: AuditStore,
  idempotency: IdempotencyStore,
  rosterStore: PlayerAgentStateStore,
  moderation: ModerationStore
) {
  const enforceLifecycle = async () => {
    await runMatchLifecycle(repo, lifecycleConfig);
  };
  const idempotencyTtlMs = Number(process.env.IDEMPOTENCY_TTL_MS ?? 24 * 60 * 60 * 1000);
  const uploadMaxBytes = Number(process.env.UPLOAD_MAX_BYTES ?? 25 * 1024 * 1024);
  const uploadWindowMs = Number(process.env.UPLOAD_RATE_WINDOW_MS ?? 60_000);
  const uploadMaxRequests = Number(process.env.UPLOAD_RATE_MAX_REQUESTS ?? 30);
  const uploadRateMap = new Map<string, { startedAt: number; count: number }>();

  const readIdempotencyKey = (request: FastifyRequest): string | null => {
    const raw = request.headers["idempotency-key"];
    if (typeof raw !== "string") {
      return null;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const executeIdempotent = async <T>(args: {
    request: FastifyRequest;
    reply: FastifyReply;
    actorUserId: string;
    scope: string;
    execute: () => Promise<{ statusCode?: number; payload: T }>;
  }): Promise<{ replayed: boolean; payload?: T }> => {
    const key = readIdempotencyKey(args.request);
    if (!key) {
      const result = await args.execute();
      if (result.statusCode) {
        args.reply.code(result.statusCode);
      }
      args.reply.send(result.payload);
      return { replayed: false, payload: result.payload };
    }

    const replay = await idempotency.find(key, args.scope, args.actorUserId);
    if (replay) {
      args.reply.code(replay.statusCode).send(replay.responseBody);
      return { replayed: true };
    }

    const result = await args.execute();
    const statusCode = result.statusCode ?? 200;
    await idempotency.save({
      key,
      scope: args.scope,
      actorUserId: args.actorUserId,
      statusCode,
      responseBody: result.payload,
      ttlMs: idempotencyTtlMs
    });
    args.reply.code(statusCode).send(result.payload);
    return { replayed: false, payload: result.payload };
  };

  const recordAudit = async (event: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: unknown;
  }) => {
    await audit.record({
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload
    });
  };

  const assertUploadRateLimit = (userId: string) => {
    const timestamp = now();
    const row = uploadRateMap.get(userId);
    if (!row || timestamp - row.startedAt > uploadWindowMs) {
      uploadRateMap.set(userId, { startedAt: timestamp, count: 1 });
      return;
    }
    row.count += 1;
    uploadRateMap.set(userId, row);
    if (row.count > uploadMaxRequests) {
      throw new HttpError(429, "Upload rate limit exceeded. Please retry later.");
    }
  };

  const parseRegion = (value: string | undefined): Region => {
    const regions: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];
    if (!value) {
      return "OTHER";
    }
    const normalized = value.toUpperCase();
    return regions.includes(normalized as Region) ? (normalized as Region) : "OTHER";
  };

  const assertNoQueueBan = async (userId: string): Promise<void> => {
    const sanctions = await moderation.listActiveSanctionsByUser(userId);
    const blocking = sanctions.find(
      (sanction) => sanction.type === "TIME_BAN" || sanction.type === "SEASON_BAN"
    );
    if (!blocking) {
      return;
    }
    throw new HttpError(403, `Queue access blocked by active sanction (${blocking.type}).`);
  };

  const ensureRankedDraftAgentEligibility = async (
    user: User,
    match: Match,
    agentId: string
  ): Promise<void> => {
    const ruleset = await repo.findRuleset(match.rulesetId);
    if (!ruleset.requireVerifier) {
      return;
    }
    if (user.verification.status !== "VERIFIED" || !user.verification.uid) {
      throw new Error("Ranked draft requires a verified UID.");
    }
    const rosterRegion = parseRegion(user.verification.region ?? user.region);
    const states = await rosterStore.listStates(user.verification.uid, rosterRegion);
    const state = states.find((item) => item.agentId === agentId);
    if (!state?.owned) {
      throw new Error("Agent is not available in your verified roster.");
    }
    if (state.source === "MANUAL") {
      throw new Error("Ranked draft requires showcase-verified roster evidence.");
    }
  };

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/metrics", async (_request, reply) => {
    try {
      const activeStates: Match["state"][] = [
        "CHECKIN",
        "DRAFTING",
        "AWAITING_PRECHECK",
        "READY_TO_START",
        "IN_PROGRESS",
        "AWAITING_RESULT_UPLOAD",
        "AWAITING_CONFIRMATION",
        "DISPUTED"
      ];
      const [queues, waitingTickets, activeMatches, openDisputes] = await Promise.all([
        repo.listQueues(),
        repo.listMatchmakingEntries(),
        repo.listMatchesByStates(activeStates),
        repo.listOpenDisputes()
      ]);
      reply.send({
        queuesConfigured: queues.length,
        matchmakingTickets: waitingTickets.length,
        activeMatches: activeMatches.length,
        openDisputes: openDisputes.length,
        timestamp: now()
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/matchmaking/lobbies", async (request, reply) => {
    try {
      await enforceLifecycle();
      reply.send(await getLobbyStats(repo));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/uploads/presign", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      assertUploadRateLimit(user.id);
      const body = request.body as {
        purpose?: string;
        contentType?: string;
        extension?: string;
      };
      if (body?.contentType && !isAllowedUploadType(body.contentType)) {
        throw new HttpError(400, "Unsupported upload content type.");
      }
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

  app.put("/uploads/local/:encodedKey", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      assertUploadRateLimit(user.id);
      if (!storage.storeObject) {
        throw new HttpError(404, "Local upload endpoint is unavailable.");
      }
      const encodedKey = requireString(
        (request.params as { encodedKey?: string }).encodedKey,
        "encodedKey"
      );
      const key = decodeURIComponent(encodedKey);
      const contentType = request.headers["content-type"];
      const normalizedType = typeof contentType === "string" ? contentType : undefined;
      if (normalizedType && !isAllowedUploadType(normalizedType)) {
        throw new HttpError(400, "Unsupported upload content type.");
      }
      const body = await readRawBody(request.raw, uploadMaxBytes);
      await storage.storeObject(key, { body, contentType: normalizedType });
      reply.code(200).send({ status: "ok", key });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/uploads/local/:encodedKey", async (request, reply) => {
    try {
      if (!storage.readObject) {
        throw new HttpError(404, "Local storage reader is unavailable.");
      }
      const encodedKey = requireString(
        (request.params as { encodedKey?: string }).encodedKey,
        "encodedKey"
      );
      const key = decodeURIComponent(encodedKey);
      const object = await storage.readObject(key);
      if (!object) {
        throw new HttpError(404, "File not found");
      }
      reply.header("Content-Type", object.contentType ?? "application/octet-stream");
      reply.send(object.body);
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

  app.get("/analytics/pick-ban", async (_request, reply) => {
    try {
      const matches = await repo.listMatchesByStates(["RESOLVED"]);
      reply.send(buildPickBanAnalytics(matches));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/analytics/agent-combos", async (_request, reply) => {
    try {
      const matches = await repo.listMatchesByStates(["RESOLVED"]);
      reply.send(buildComboAnalytics(matches));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/analytics/season/report", async (_request, reply) => {
    try {
      const [season, matches] = await Promise.all([
        repo.getActiveSeason(),
        repo.listMatchesByStates(["RESOLVED"])
      ]);
      const seasonMatches = matches.filter((match) => match.seasonId === season.id);
      const disputes = await repo.listOpenDisputes();
      reply.send({
        seasonId: season.id,
        totalMatches: seasonMatches.length,
        disputedOpen: disputes.length,
        resolvedWithModeration: seasonMatches.filter(
          (match) => match.resolution?.source === "MODERATION"
        ).length,
        averageMatchDurationSec: null
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matchmaking/join", async (request, reply) => {
    try {
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      await assertNoQueueBan(user.id);
      const body = request.body as { queueId?: string };
      const queueId = requireString(body?.queueId, "queueId");
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `matchmaking:join:${queueId}`,
        execute: async () => {
          const match = await createMatchFromQueue(repo, queueId, user.id);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCHMAKING_JOIN",
            entityType: "MATCH",
            entityId: match.id,
            payload: { queueId }
          });
          return { payload: match };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matchmaking/search", async (request, reply) => {
    try {
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      await assertNoQueueBan(user.id);
      const body = request.body as { queueId?: string };
      const queueId = requireString(body?.queueId, "queueId");
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `matchmaking:search:${queueId}`,
        execute: async () => {
          const payload = await searchMatch(repo, queueId, user.id);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCHMAKING_SEARCH",
            entityType: "MATCHMAKING_TICKET",
            entityId: payload.ticketId,
            payload: { queueId, status: payload.status, matchId: payload.match?.id }
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/matchmaking/status/:ticketId", async (request, reply) => {
    try {
      await enforceLifecycle();
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
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      const body = request.body as { ticketId?: string };
      const ticketId = requireString(body?.ticketId, "ticketId");
      const ticket = await repo.findMatchmakingEntry(ticketId);
      if (ticket.userId !== user.id && !isModerator(user)) {
        throw new HttpError(403, "Forbidden");
      }
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `matchmaking:cancel:${ticketId}`,
        execute: async () => {
          const payload = await cancelMatchmaking(repo, ticketId);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCHMAKING_CANCEL",
            entityType: "MATCHMAKING_TICKET",
            entityId: ticketId,
            payload: { status: payload.status, matchId: payload.match?.id }
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/matches/:id", async (request, reply) => {
    try {
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      reply.send(match);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/matches/:id/events", async (request, reply) => {
    try {
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const initialMatch = await repo.findMatch(matchId);
      assertParticipant(user, initialMatch);

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });

      let closed = false;
      let lastUpdatedAt = initialMatch.updatedAt;
      const sendEvent = (eventName: string, payload: unknown) => {
        reply.raw.write(`event: ${eventName}\n`);
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      sendEvent("match", initialMatch);

      const interval = setInterval(async () => {
        if (closed) {
          return;
        }
        try {
          await enforceLifecycle();
          const next = await repo.findMatch(matchId);
          if (next.updatedAt !== lastUpdatedAt) {
            lastUpdatedAt = next.updatedAt;
            sendEvent("match", next);
            return;
          }
          sendEvent("ping", { ts: now() });
        } catch {
          sendEvent("error", { error: "stream_update_failed" });
        }
      }, 1000);

      request.raw.on("close", () => {
        closed = true;
        clearInterval(interval);
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/checkin", async (request, reply) => {
    try {
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `match:checkin:${matchId}`,
        execute: async () => {
          const payload = await markCheckin(repo, matchId, user.id);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCH_CHECKIN",
            entityType: "MATCH",
            entityId: matchId
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/draft/action", async (request, reply) => {
    try {
      await enforceLifecycle();
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
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `match:draft:${matchId}:${type}`,
        execute: async () => {
          await ensureRankedDraftAgentEligibility(user, match, agentId);
          const payload = await applyDraftAction(repo, matchId, {
            type,
            agentId,
            userId: user.id,
            timestamp: now()
          });
          await recordAudit({
            actorUserId: user.id,
            action: "MATCH_DRAFT_ACTION",
            entityType: "MATCH",
            entityId: matchId,
            payload: { type, agentId }
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/evidence/precheck", async (request, reply) => {
    try {
      await enforceLifecycle();
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
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `match:precheck:${matchId}`,
        execute: async () => {
          const payload = await recordPrecheck(repo, matchId, record);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCH_PRECHECK_SUBMIT",
            entityType: "MATCH",
            entityId: matchId,
            payload: {
              result: record.result,
              detectedAgents: record.detectedAgents
            }
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/evidence/inrun", async (request, reply) => {
    try {
      await enforceLifecycle();
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
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `match:inrun:${matchId}`,
        execute: async () => {
          const payload = await recordInrun(repo, matchId, record);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCH_INRUN_SUBMIT",
            entityType: "MATCH",
            entityId: matchId,
            payload: {
              result: record.result,
              detectedAgents: record.detectedAgents
            }
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/result/submit", async (request, reply) => {
    try {
      await enforceLifecycle();
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
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `match:result:${matchId}`,
        execute: async () => {
          const updated = await recordResult(repo, matchId, payload);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCH_RESULT_SUBMIT",
            entityType: "MATCH",
            entityId: matchId,
            payload: {
              metricType,
              value,
              proofUrl,
              demoUrl: body?.demoUrl
            }
          });
          return { payload: updated };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/confirm", async (request, reply) => {
    try {
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `match:confirm:${matchId}`,
        execute: async () => {
          const payload = await confirmMatch(repo, matchId, user.id);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCH_CONFIRM",
            entityType: "MATCH",
            entityId: matchId
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/matches/:id/dispute/open", async (request, reply) => {
    try {
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      const matchId = requireString((request.params as { id?: string }).id, "matchId");
      const match = await repo.findMatch(matchId);
      assertParticipant(user, match);
      const body = request.body as { reason?: string; evidenceUrls?: string[] };
      const reason = requireString(body?.reason, "reason");
      const evidenceUrls = body?.evidenceUrls?.filter((item) => typeof item === "string");
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `match:dispute-open:${matchId}`,
        execute: async () => {
          const payload = await openDispute(repo, matchId, user.id, reason, evidenceUrls);
          await recordAudit({
            actorUserId: user.id,
            action: "MATCH_DISPUTE_OPEN",
            entityType: "DISPUTE",
            entityId: payload.id,
            payload: { matchId, reason }
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/disputes/queue", async (request, reply) => {
    try {
      await enforceLifecycle();
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
      await enforceLifecycle();
      const user = await requireAuthUser(request, repo, auth);
      if (!isModerator(user)) {
        throw new HttpError(403, "Forbidden");
      }
      const disputeId = requireString((request.params as { id?: string }).id, "disputeId");
      const body = request.body as { decision?: string; winnerUserId?: string };
      const decision = requireString(body?.decision, "decision");
      const result = await executeIdempotent({
        request,
        reply,
        actorUserId: user.id,
        scope: `dispute:decision:${disputeId}`,
        execute: async () => {
          const payload = await resolveDispute(
            repo,
            disputeId,
            decision,
            user.id,
            body?.winnerUserId
          );
          await recordAudit({
            actorUserId: user.id,
            action: "DISPUTE_DECISION",
            entityType: "DISPUTE",
            entityId: disputeId,
            payload: {
              decision,
              winnerUserId: body?.winnerUserId
            }
          });
          return { payload };
        }
      });
      if (result.replayed) {
        return;
      }
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/admin/audit", async (request, reply) => {
    try {
      const user = await requireAuthUser(request, repo, auth);
      if (!isModerator(user)) {
        throw new HttpError(403, "Forbidden");
      }
      const query = request.query as {
        limit?: string;
        actorUserId?: string;
        action?: string;
        entityType?: string;
      };
      const limitRaw = Number(query.limit ?? 100);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
      const rows = await audit.list({
        limit,
        actorUserId: query.actorUserId,
        action: query.action,
        entityType: query.entityType
      });
      reply.send(rows);
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

function isAllowedUploadType(contentType: string): boolean {
  const normalized = contentType.toLowerCase().trim();
  return (
    normalized.startsWith("image/") ||
    normalized.startsWith("video/") ||
    normalized === "application/octet-stream"
  );
}

function readRawBody(stream: NodeJS.ReadableStream, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    stream.on("data", (chunk: Buffer | string) => {
      const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += piece.length;
      if (size > maxBytes) {
        reject(new HttpError(413, "Upload exceeds size limit."));
        return;
      }
      chunks.push(piece);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function buildPickBanAnalytics(matches: Match[]) {
  const stats = new Map<
    string,
    { agentId: string; picks: number; bans: number; wins: number; losses: number }
  >();

  const ensure = (agentId: string) => {
    if (!stats.has(agentId)) {
      stats.set(agentId, {
        agentId,
        picks: 0,
        bans: 0,
        wins: 0,
        losses: 0
      });
    }
    return stats.get(agentId)!;
  };

  for (const match of matches) {
    const winner = match.resolution?.winnerUserId ?? match.evidence.result?.winnerUserId;
    for (const action of match.draft.actions) {
      const row = ensure(action.agentId);
      if (action.type.startsWith("BAN")) {
        row.bans += 1;
        continue;
      }
      if (action.type.startsWith("PICK")) {
        row.picks += 1;
        if (!winner) {
          continue;
        }
        if (action.userId === winner) {
          row.wins += 1;
        } else {
          row.losses += 1;
        }
      }
    }
  }

  return Array.from(stats.values())
    .map((row) => ({
      ...row,
      winrate: row.wins + row.losses > 0 ? row.wins / (row.wins + row.losses) : null
    }))
    .sort((a, b) => b.picks + b.bans - (a.picks + a.bans));
}

function buildComboAnalytics(matches: Match[]) {
  const combos = new Map<string, { combo: [string, string]; matches: number; wins: number }>();

  for (const match of matches) {
    const winner = match.resolution?.winnerUserId ?? match.evidence.result?.winnerUserId;
    const byUser = new Map<string, string[]>();
    for (const action of match.draft.actions) {
      if (!action.type.startsWith("PICK")) {
        continue;
      }
      const list = byUser.get(action.userId) ?? [];
      list.push(action.agentId);
      byUser.set(action.userId, list);
    }

    for (const [userId, picks] of byUser.entries()) {
      const unique = Array.from(new Set(picks)).sort();
      for (let i = 0; i < unique.length; i += 1) {
        for (let j = i + 1; j < unique.length; j += 1) {
          const a = unique[i];
          const b = unique[j];
          if (!a || !b) {
            continue;
          }
          const key = `${a}:${b}`;
          const row = combos.get(key) ?? { combo: [a, b], matches: 0, wins: 0 };
          row.matches += 1;
          if (winner && winner === userId) {
            row.wins += 1;
          }
          combos.set(key, row);
        }
      }
    }
  }

  return Array.from(combos.values())
    .map((row) => ({
      combo: row.combo,
      matches: row.matches,
      wins: row.wins,
      winrate: row.matches > 0 ? row.wins / row.matches : 0
    }))
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 100);
}
