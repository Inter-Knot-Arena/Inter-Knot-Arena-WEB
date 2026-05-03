import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types.js";
import type { CatalogStore } from "../catalog/store.js";
import type { PlayerAgentStateStore } from "../roster/types.js";
import { computeEligibility, mergePlayerAgentDynamic } from "@ika/shared";
import type {
  PlayerAgentDynamic,
  PlayerRosterImportSummary,
  PlayerRosterView,
  Region,
  Ruleset,
  User
} from "@ika/shared";
import { getAuthUser, type AuthContext } from "../auth/context.js";

class RouteError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "ROSTER_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
  }
}

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  if (error instanceof RouteError) {
    reply.code(error.status).send({
      error: error.message,
      code: error.code,
      details: error.details
    });
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message, code: "ROSTER_ERROR" });
}

const REGIONS: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];
const legacyRosterImportEnabled = process.env.ENABLE_LEGACY_ROSTER_IMPORT === "true";

function validateUid(uid: string): boolean {
  return /^\d{6,12}$/.test(uid);
}

function parseRegion(value: unknown): Region | null {
  if (typeof value !== "string") {
    return null;
  }
  return REGIONS.includes(value as Region) ? (value as Region) : null;
}

function normalizeConfidenceMap(
  value: unknown,
  context: string
): Record<string, number> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RouteError(
      `${context} must be an object.`,
      400,
      "INVALID_VERIFIER_CONFIDENCE_MAP"
    );
  }

  const normalized: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 1) {
      throw new RouteError(
        `${context}.${key} is invalid. Expected range [0, 1].`,
        400,
        "INVALID_VERIFIER_CONFIDENCE_VALUE"
      );
    }
    normalized[key] = raw;
  }
  return normalized;
}

function normalizeNumberMap(
  value: unknown,
  context: string
): Record<string, number> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RouteError(`${context} must be an object.`, 400, "INVALID_VERIFIER_NUMERIC_MAP");
  }

  const normalized: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new RouteError(
        `${context}.${key} must be a finite number.`,
        400,
        "INVALID_VERIFIER_NUMERIC_VALUE"
      );
    }
    normalized[key] = raw;
  }
  return normalized;
}

function normalizeBooleanMap(
  value: unknown,
  context: string
): Record<string, boolean> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RouteError(`${context} must be an object.`, 400, "INVALID_VERIFIER_BOOLEAN_MAP");
  }

  const normalized: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "boolean") {
      throw new RouteError(
        `${context}.${key} must be a boolean.`,
        400,
        "INVALID_VERIFIER_BOOLEAN_VALUE"
      );
    }
    normalized[key] = raw;
  }
  return normalized;
}

function normalizeStringMap(
  value: unknown,
  context: string
): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RouteError(`${context} must be an object.`, 400, "INVALID_VERIFIER_STRING_MAP");
  }

  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "string") {
      throw new RouteError(
        `${context}.${key} must be a string.`,
        400,
        "INVALID_VERIFIER_STRING_VALUE"
      );
    }
    normalized[key] = raw;
  }
  return normalized;
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new RouteError(`${fieldName} must be a string.`, 400, "INVALID_VERIFIER_STRING");
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RouteError(`${fieldName} must be a non-negative number.`, 400, "INVALID_VERIFIER_NUMBER");
  }
  return value;
}

function keepNonEmptyMap<T>(value: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.keys(value).length > 0 ? value : undefined;
}

function buildVerifierImportedAgentState(args: {
  agentId: string;
  raw: {
    owned?: boolean;
    level?: number;
    levelCap?: number;
    dupes?: number;
    mindscape?: number;
    mindscapeCap?: number;
    promotion?: number;
    talent?: number;
    core?: number;
    weapon?: PlayerAgentDynamic["weapon"];
    weaponPresent?: boolean;
    discs?: PlayerAgentDynamic["discs"];
  };
  stats?: Record<string, number>;
  discSlotOccupancy?: Record<string, boolean>;
  confidenceByField?: Record<string, number>;
  fieldSources?: Record<string, string>;
  importedAt: string;
}): PlayerAgentDynamic {
  const state: PlayerAgentDynamic = {
    agentId: args.agentId,
    owned: args.raw.owned ?? true,
    source: "VERIFIER_OCR",
    lastImportedAt: args.importedAt,
    updatedAt: args.importedAt
  };

  if (args.raw.level !== undefined) {
    state.level = args.raw.level;
  }
  if (args.raw.levelCap !== undefined) {
    state.levelCap = args.raw.levelCap;
  }
  if (args.raw.dupes !== undefined) {
    state.dupes = args.raw.dupes;
  }
  if (args.raw.mindscape !== undefined) {
    state.mindscape = args.raw.mindscape;
  }
  if (args.raw.mindscapeCap !== undefined) {
    state.mindscapeCap = args.raw.mindscapeCap;
  }
  if (args.raw.promotion !== undefined) {
    state.promotion = args.raw.promotion;
  }
  if (args.raw.talent !== undefined) {
    state.talent = args.raw.talent;
  }
  if (args.raw.core !== undefined) {
    state.core = args.raw.core;
  }
  if (args.stats) {
    state.stats = args.stats;
  }
  if (args.raw.weapon !== undefined) {
    state.weapon = args.raw.weapon;
  }
  if (args.raw.weaponPresent !== undefined) {
    state.weaponPresent = args.raw.weaponPresent;
  }
  if (args.discSlotOccupancy) {
    state.discSlotOccupancy = args.discSlotOccupancy;
  }
  if (args.raw.discs !== undefined) {
    state.discs = args.raw.discs;
  }
  if (args.confidenceByField) {
    state.confidenceByField = args.confidenceByField;
    state.confidence = args.confidenceByField;
  }
  if (args.fieldSources) {
    state.fieldSources = args.fieldSources;
  }

  return state;
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

  app.post("/verifier/roster/import", async (request, reply) => {
    try {
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      const body = request.body as {
        uid?: string;
        region?: string;
        fullSync?: boolean;
        modelVersion?: string;
        dataVersion?: string;
        scanMeta?: string;
        timingMs?: number;
        resolution?: string;
        locale?: string;
        lowConfReasons?: string[];
        confidenceByField?: Record<string, number>;
        fieldSources?: Record<string, string>;
        capabilities?: Record<string, boolean>;
        agents?: Array<{
          agentId?: string;
          owned?: boolean;
          level?: number;
          levelCap?: number;
          dupes?: number;
          mindscape?: number;
          mindscapeCap?: number;
          promotion?: number;
          talent?: number;
          core?: number;
          stats?: Record<string, number>;
          weapon?: PlayerAgentDynamic["weapon"];
          weaponPresent?: boolean;
          discSlotOccupancy?: Record<string, boolean>;
          discs?: PlayerAgentDynamic["discs"];
          confidenceByField?: Record<string, number>;
          confidence?: Record<string, number>;
          fieldSources?: Record<string, string>;
        }>;
      };

      const rawUid = typeof body.uid === "string" ? body.uid.trim() : "";
      const linkedUid =
        typeof user.verification?.uid === "string" ? user.verification.uid.trim() : "";
      const hasValidBodyUid = rawUid.length > 0 && validateUid(rawUid);
      const hasLinkedUid = linkedUid.length > 0;

      let uid = "";
      if (hasValidBodyUid) {
        uid = rawUid;
      } else if (hasLinkedUid) {
        uid = linkedUid;
      }

      if (!uid) {
        throw new RouteError("UID must be 6-12 digits", 400, "INVALID_VERIFIER_UID");
      }

      if (hasLinkedUid && hasValidBodyUid && linkedUid !== rawUid) {
        reply.code(403).send({
          error: "UID mismatch with linked account",
          code: "UID_MISMATCH_LINKED_ACCOUNT"
        });
        return;
      }
      const region = parseRegion(body.region);
      if (!region) {
        throw new RouteError("Invalid region", 400, "INVALID_VERIFIER_REGION");
      }
      if (user.verification.uid && user.verification.uid !== uid) {
        reply.code(403).send({
          error: "UID mismatch with linked account",
          code: "UID_MISMATCH_LINKED_ACCOUNT"
        });
        return;
      }

      const incoming = Array.isArray(body.agents) ? body.agents : [];
      const lowConfReasons = Array.isArray(body.lowConfReasons)
        ? body.lowConfReasons
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
      const importConfidenceByField = normalizeConfidenceMap(
        body.confidenceByField,
        "confidenceByField"
      );
      const importFieldSources = normalizeStringMap(body.fieldSources, "fieldSources");
      const importCapabilities = normalizeBooleanMap(body.capabilities, "capabilities");
      const modelVersion = normalizeOptionalString(body.modelVersion, "modelVersion");
      const dataVersion = normalizeOptionalString(body.dataVersion, "dataVersion");
      const scanMeta = normalizeOptionalString(body.scanMeta, "scanMeta");
      const resolution = normalizeOptionalString(body.resolution, "resolution");
      const locale = normalizeOptionalString(body.locale, "locale");
      const timingMs = normalizeOptionalNumber(body.timingMs, "timingMs");
      const catalogData = catalog.getCatalog();
      const catalogIds = new Set(catalogData.agents.map((agent) => agent.agentId));
      const unknownIds: string[] = [];
      const scannedById = new Map<string, PlayerAgentDynamic>();
      const importedAt = new Date().toISOString();

      for (const raw of incoming) {
        const agentId = typeof raw?.agentId === "string" ? raw.agentId.trim() : "";
        if (!agentId) {
          continue;
        }
        if (!catalogIds.has(agentId)) {
          unknownIds.push(agentId);
          continue;
        }
        const confidenceByField = normalizeConfidenceMap(
          raw?.confidenceByField ?? raw?.confidence,
          `confidenceByField for agent '${agentId}'`
        );
        const stats = keepNonEmptyMap(
          normalizeNumberMap(raw?.stats, `stats for agent '${agentId}'`)
        );
        const discSlotOccupancy = keepNonEmptyMap(normalizeBooleanMap(
          raw?.discSlotOccupancy,
          `discSlotOccupancy for agent '${agentId}'`
        ));
        const fieldSources = keepNonEmptyMap(normalizeStringMap(
          raw?.fieldSources,
          `fieldSources for agent '${agentId}'`
        ));
        const filteredConfidenceByField = keepNonEmptyMap(confidenceByField);
        const weapon =
          raw?.weapon && typeof raw.weapon === "object" && Object.keys(raw.weapon).length > 0
            ? raw.weapon
            : undefined;
        const discs =
          Array.isArray(raw?.discs) && raw.discs.length > 0
            ? raw.discs
            : undefined;

        scannedById.set(
          agentId,
          buildVerifierImportedAgentState({
            agentId,
            raw: {
              owned: raw.owned,
              level: raw.level,
              levelCap: raw.levelCap,
              dupes: raw.dupes,
              mindscape: raw.mindscape,
              mindscapeCap: raw.mindscapeCap,
              promotion: raw.promotion,
              talent: raw.talent,
              core: raw.core,
              weapon,
              weaponPresent: raw.weaponPresent,
              discs
            },
            stats,
            discSlotOccupancy,
            confidenceByField: filteredConfidenceByField,
            fieldSources,
            importedAt
          })
        );
      }

      const requestedFullSync = body.fullSync === true;
      const hasFullRosterCoverage = importCapabilities?.fullRosterCoverage === true;
      if (requestedFullSync && !hasFullRosterCoverage) {
        throw new RouteError(
          "Verifier fullSync requires capabilities.fullRosterCoverage=true.",
          409,
          "FULLSYNC_REQUIRES_FULL_ROSTER_COVERAGE"
        );
      }
      const fullSync = requestedFullSync;
      const existingStates = await rosterStore.listStates(uid, region);
      const existingStateById = new Map(existingStates.map((state) => [state.agentId, state]));
      const nextStates: PlayerAgentDynamic[] = fullSync
        ? catalogData.agents.map((agent) => {
            const scanned = scannedById.get(agent.agentId);
            if (scanned) {
              return mergePlayerAgentDynamic(existingStateById.get(agent.agentId), scanned);
            }
            return {
              agentId: agent.agentId,
              owned: false,
              source: "VERIFIER_OCR",
              lastImportedAt: importedAt,
              updatedAt: importedAt
            };
          })
        : Array.from(scannedById.values()).map((scanned) =>
            mergePlayerAgentDynamic(existingStateById.get(scanned.agentId), scanned)
          );

      if (!nextStates.length) {
        throw new RouteError(
          "No valid agents in verifier payload",
          400,
          "EMPTY_VERIFIER_AGENTS"
        );
      }

      await rosterStore.upsertStates(uid, region, nextStates, { mergeStrategy: "DIRECT" });

      const summary: PlayerRosterImportSummary = {
        source: "VERIFIER_OCR",
        importedCount: scannedById.size,
        skippedCount: unknownIds.length,
        unknownIds,
        fetchedAt: importedAt,
        status: lowConfReasons.length > 0 ? "DEGRADED" : "SUCCESS",
        modelVersion,
        dataVersion,
        scanMeta,
        timingMs,
        resolution,
        locale,
        lowConfReasons,
        confidenceByField: importConfidenceByField,
        fieldSources: importFieldSources,
        capabilities: importCapabilities,
        message:
          lowConfReasons.length > 0
            ? `Verifier roster sync completed with low confidence: ${lowConfReasons.join(", ")}.`
            : fullSync
              ? "Verifier full roster sync completed."
              : "Verifier partial roster sync completed."
      };
      await rosterStore.saveImportSummary(uid, region, summary);

      const updatedUser: User = {
        ...user,
        roles: user.roles.includes("VERIFIED") ? user.roles : [...user.roles, "VERIFIED"],
        verification: {
          status: "VERIFIED",
          uid,
          region
        },
        updatedAt: Date.now()
      };
      await repo.saveUser(updatedUser);

      reply.send({
        status: "OK",
        summary,
        verification: updatedUser.verification
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/players/:uid/roster/manual", async (request, reply) => {
    try {
      if (!legacyRosterImportEnabled) {
        reply.code(410).send({
          error:
            "Manual roster updates are deprecated. Use Verifier App OCR sync via /verifier/roster/import."
        });
        return;
      }
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
