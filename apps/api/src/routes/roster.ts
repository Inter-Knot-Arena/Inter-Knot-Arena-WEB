import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types.js";
import type { CatalogStore } from "../catalog/store.js";
import type { CacheClient } from "../cache/types.js";
import type { PlayerAgentStateStore } from "../roster/types.js";
import { computeEligibility, mergePlayerAgentDynamicAccumulative } from "@ika/shared";
import type {
  PlayerAgentDynamic,
  PlayerRosterImportSummary,
  PlayerRosterView,
  Region,
  Ruleset
} from "@ika/shared";
import { normalizeEnkaPayload } from "../enka/normalize.js";
import { getAuthUser, type AuthContext } from "../auth/context.js";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

const REGIONS: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];
const rateLimitMap = new Map<string, number>();
const accumulativeEnabled = process.env.ENABLE_ACCUMULATIVE_IMPORT === "true";
const storeRawEnka = process.env.ENKA_STORE_RAW === "true";
const rawEnkaTtlSeconds = Number(process.env.ENKA_RAW_TTL_SEC ?? 60 * 60 * 24 * 14);
const ENKA_REGION_FALLBACKS: Region[] = ["NA", "EU", "ASIA", "SEA"];

class EnkaHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly requestUrl: string
  ) {
    super(`Enka request failed (${status})`);
  }
}

function validateUid(uid: string): boolean {
  return /^\d{6,12}$/.test(uid);
}

function parseRegion(value: unknown): Region | null {
  if (typeof value !== "string") {
    return null;
  }
  return REGIONS.includes(value as Region) ? (value as Region) : null;
}

function buildEnkaUrl(uid: string, region: Region, includeRegion = true): string {
  const base = process.env.ENKA_BASE_URL ?? "https://enka.network/api/zzz/uid";
  const trimmed = base.replace(/\/+$/, "");
  const url = new URL(`${trimmed}/${uid}`);
  if (includeRegion && region && region !== "OTHER") {
    url.searchParams.set("region", region);
  }
  return url.toString();
}

async function fetchJsonWithRetry(url: string, timeoutMs: number): Promise<unknown> {
  const attempts = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new EnkaHttpError(response.status, url);
      }
      return (await response.json()) as unknown;
    } catch (error) {
      lastError = error;
      const canRetry =
        !(error instanceof EnkaHttpError) || error.status === 429 || error.status >= 500;
      if (attempt < attempts - 1 && canRetry) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function fetchEnkaPayload(uid: string, region: Region, timeoutMs: number): Promise<unknown> {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (url: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      candidates.push(url);
    }
  };

  if (region !== "OTHER") {
    pushCandidate(buildEnkaUrl(uid, region, true));
    pushCandidate(buildEnkaUrl(uid, region, false));
  } else {
    pushCandidate(buildEnkaUrl(uid, region, false));
  }

  ENKA_REGION_FALLBACKS.forEach((candidateRegion) => {
    if (candidateRegion !== region) {
      pushCandidate(buildEnkaUrl(uid, candidateRegion, true));
    }
  });

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return await fetchJsonWithRetry(candidate, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Enka request failed");
}

function messageForEnkaError(error: unknown, region: Region): string {
  if (error instanceof EnkaHttpError) {
    if (error.status === 404) {
      return `Showcase not found for UID in region ${region}. Check region and ensure showcase is public.`;
    }
    if (error.status === 403) {
      return "Enka denied request. Please retry later.";
    }
    if (error.status === 429) {
      return "Enka rate limit reached. Please retry in 1-2 minutes.";
    }
    if (error.status >= 500) {
      return "Enka service is temporarily unavailable. Please retry later.";
    }
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "Enka request timed out. Please retry.";
  }
  return "Could not fetch showcase data. Please retry later.";
}

async function resolveRuleset(repo: Repository, rulesetId?: string): Promise<Ruleset> {
  if (rulesetId) {
    return repo.findRuleset(rulesetId);
  }
  const rulesets = await repo.listRulesets();
  const resolved = rulesets.find((item) => item.id === "ruleset_standard_v1") ?? rulesets[0];
  if (!resolved) {
    throw new Error("No rulesets available");
  }
  return resolved;
}

export async function registerRosterRoutes(
  app: FastifyInstance,
  repo: Repository,
  catalog: CatalogStore,
  rosterStore: PlayerAgentStateStore,
  cache: CacheClient,
  cacheTtlMs: number,
  auth: AuthContext
) {
  app.get("/players/:uid/roster", async (request, reply) => {
    try {
      const params = request.params as { uid?: string };
      const uid = params.uid ?? "";
      if (!validateUid(uid)) {
        throw new Error("Invalid UID");
      }

      const query = request.query as { region?: string; rulesetId?: string };
      const parsedRegion = parseRegion(query?.region);
      if (query?.region && !parsedRegion) {
        throw new Error("Invalid region");
      }
      const region = parsedRegion ?? "OTHER";
      const ruleset = await resolveRuleset(repo, query?.rulesetId);
      const catalogData = catalog.getCatalog();
      const states = await rosterStore.listStates(uid, region);
      const stateMap = new Map(states.map((state) => [state.agentId, state]));
      const lastImport = await rosterStore.getImportSummary(uid, region);

      const roster: PlayerRosterView = {
        uid,
        region,
        catalogVersion: catalogData.catalogVersion,
        agents: catalogData.agents.map((agent) => {
          const state = stateMap.get(agent.agentId);
          return {
            agent,
            state,
            eligibility: computeEligibility(agent, state, ruleset)
          };
        }),
        lastImport: lastImport ?? undefined
      };

      reply.send(roster);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/players/:uid/import/enka", async (request, reply) => {
    try {
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      const params = request.params as { uid?: string };
      const uid = params.uid ?? "";
      if (!validateUid(uid)) {
        throw new Error("Invalid UID");
      }
      const canModerate =
        user.roles.includes("MODER") || user.roles.includes("STAFF") || user.roles.includes("ADMIN");
      if (user.verification.uid !== uid && !canModerate) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }

      const body = request.body as { region?: string; force?: boolean };
      const region = parseRegion(body?.region);
      if (!region) {
        throw new Error("Invalid region");
      }
      const force = body?.force === true;

      const rateLimitMs = Number(process.env.ENKA_RATE_LIMIT_MS ?? 30000);
      const limitKey = `${region}:${uid}`;
      const lastRequest = rateLimitMap.get(limitKey) ?? 0;
      if (!force && Date.now() - lastRequest < rateLimitMs) {
        reply.code(429).send({ error: "Too many requests, try again later." });
        return;
      }
      rateLimitMap.set(limitKey, Date.now());

      const cacheKey = `enka:${limitKey}`;
      const cached = !force ? cache.get<{ payload: unknown; fetchedAt: string }>(cacheKey) : null;
      let fetchedAt = cached?.fetchedAt ?? new Date().toISOString();
      let payload: unknown = cached?.payload ?? null;

      if (!payload) {
        fetchedAt = new Date().toISOString();
        try {
          payload = await fetchEnkaPayload(
            uid,
            region,
            Number(process.env.ENKA_TIMEOUT_MS ?? 8000)
          );
          cache.set(cacheKey, { payload, fetchedAt }, cacheTtlMs);
        } catch (error) {
          const summary: PlayerRosterImportSummary = {
            source: "ENKA_SHOWCASE",
            importedCount: 0,
            skippedCount: 0,
            unknownIds: [],
            fetchedAt,
            message: messageForEnkaError(error, region)
          };
          await rosterStore.saveImportSummary(uid, region, summary);
          reply.send(summary);
          return;
        }
      }

      const { agents, unknownIds } = normalizeEnkaPayload(
        payload,
        catalog.getMapping(),
        fetchedAt,
        catalog.getDiscSetMap()
      );
      const skippedCount = unknownIds.filter((id) => id.startsWith("character:")).length;
      const summary: PlayerRosterImportSummary = {
        source: "ENKA_SHOWCASE",
        importedCount: agents.length,
        skippedCount,
        unknownIds,
        fetchedAt,
        message: agents.length === 0 ? "No showcase data available." : undefined
      };

      if (agents.length > 0) {
        if (accumulativeEnabled) {
          const existingStates = await rosterStore.listStates(uid, region);
          const existingMap = new Map(existingStates.map((state) => [state.agentId, state]));
          let newAgentsCount = 0;
          let updatedAgentsCount = 0;
          let unchangedCount = 0;

          const merged = agents.map((incoming) => {
            const existing = existingMap.get(incoming.agentId);
            const incomingWithFlags = {
              ...incoming,
              owned: true,
              lastImportedAt: fetchedAt,
              lastShowcaseSeenAt: fetchedAt,
              updatedAt: fetchedAt
            };
            const mergedState = mergePlayerAgentDynamicAccumulative(existing, incomingWithFlags);

            if (!existing) {
              newAgentsCount += 1;
            } else {
              const stripTimestamps = (state: PlayerAgentDynamic) => {
                const { lastImportedAt, lastShowcaseSeenAt, updatedAt, ...rest } = state;
                return rest;
              };
              const existingComparable = JSON.stringify(stripTimestamps(existing));
              const mergedComparable = JSON.stringify(stripTimestamps(mergedState));
              if (existingComparable === mergedComparable) {
                unchangedCount += 1;
              } else {
                updatedAgentsCount += 1;
              }
            }
            return mergedState;
          });

          summary.newAgentsCount = newAgentsCount;
          summary.updatedAgentsCount = updatedAgentsCount;
          summary.unchangedCount = unchangedCount;
          summary.ttlSeconds = storeRawEnka ? rawEnkaTtlSeconds : 0;

          await rosterStore.upsertStates(uid, region, merged, { mergeStrategy: "DIRECT" });

          const showcaseAgentIds = [
            ...merged.map((item) => String(item.agentGameId ?? item.agentId)),
            ...unknownIds
              .filter((id) => id.startsWith("character:"))
              .flatMap((id) => {
                const [, rawId] = id.split(":");
                return rawId ? [rawId] : [];
              })
          ];

          await rosterStore.saveSnapshot({
            snapshotId: `snap_${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            uid,
            region,
            fetchedAt,
            showcaseAgentIds,
            rawEnkaJson: storeRawEnka ? payload : undefined,
            ttlSeconds: storeRawEnka ? rawEnkaTtlSeconds : 0
          });
        } else {
          await rosterStore.upsertStates(uid, region, agents);
        }
      }
      await rosterStore.saveImportSummary(uid, region, summary);

      reply.send(summary);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/players/:uid/roster/manual", async (request, reply) => {
    try {
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      const params = request.params as { uid?: string };
      const uid = params.uid ?? "";
      if (!validateUid(uid)) {
        throw new Error("Invalid UID");
      }
      const canModerate =
        user.roles.includes("MODER") || user.roles.includes("STAFF") || user.roles.includes("ADMIN");
      if (user.verification.uid !== uid && !canModerate) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }

      const body = request.body as {
        region?: string;
        agentId?: string;
        owned?: boolean;
        agents?: Array<{
          agentId: string;
          owned?: boolean;
          level?: number;
          dupes?: number;
          mindscape?: number;
          promotion?: number;
          talent?: number;
          core?: number;
        }>;
      };

      const region = parseRegion(body?.region);
      if (!region) {
        throw new Error("Invalid region");
      }

      const catalogIds = new Set(catalog.getCatalog().agents.map((agent) => agent.agentId));
      const incomingAgents =
        body?.agents ??
        (body?.agentId
          ? [{ agentId: body.agentId, owned: body.owned }]
          : []);

      if (!incomingAgents.length) {
        throw new Error("No agents provided");
      }

      const now = new Date().toISOString();
      const states: PlayerAgentDynamic[] = incomingAgents.map((agent) => {
        if (!catalogIds.has(agent.agentId)) {
          throw new Error(`Unknown agentId ${agent.agentId}`);
        }
        return {
          agentId: agent.agentId,
          owned: agent.owned ?? true,
          level: agent.level,
          dupes: agent.dupes,
          mindscape: agent.mindscape,
          promotion: agent.promotion,
          talent: agent.talent,
          core: agent.core,
          source: "MANUAL",
          updatedAt: now
        };
      });

      await rosterStore.upsertStates(uid, region, states, { mergeStrategy: "ACCUMULATIVE" });

      reply.send({ updatedCount: states.length, updatedAt: now });
    } catch (error) {
      sendError(reply, error);
    }
  });
}
