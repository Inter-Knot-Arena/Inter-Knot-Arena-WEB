import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createApp } from "../app.js";

let app: FastifyInstance;
const originalRepository = process.env.IKA_REPOSITORY;
const originalAuthDisabled = process.env.AUTH_DISABLED;
const originalSessionSecret = process.env.SESSION_SECRET;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const originalGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI;

function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function createEvidenceSignature(args: {
  matchId: string;
  userId: string;
  type: "PRECHECK" | "INRUN";
  detectedAgents: string[];
  confidence?: Record<string, number>;
  result: "PASS" | "VIOLATION" | "LOW_CONF";
  frameHash: string;
  nonce: string;
  token: string;
}): string {
  const payload = JSON.stringify({
    matchId: args.matchId,
    userId: args.userId,
    type: args.type,
    result: args.result,
    frameHash: args.frameHash,
    detectedAgents: args.detectedAgents,
    confidence: Object.fromEntries(
      Object.entries(args.confidence ?? {}).sort(([left], [right]) => left.localeCompare(right))
    ),
    nonce: args.nonce
  });
  return createHmac("sha256", args.token).update(payload).digest("hex");
}

async function registerAndGetCookie(
  email: string,
  displayName: string
): Promise<string> {
  const register = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email,
      password: "super-secure-pass",
      displayName
    }
  });
  assert.equal(register.statusCode, 200);
  return readCookie(register.headers as Record<string, unknown>);
}

async function issueVerifierToken(cookie: string, redirectPort: number): Promise<{
  accessToken: string;
  userId: string;
}> {
  const codeVerifier = `verifier-code-${redirectPort}-abcdefghijklmnopqrstuvwxyz`;
  const start = await app.inject({
    method: "POST",
    url: "/auth/verifier/device/start",
    payload: {
      codeChallenge: createCodeChallenge(codeVerifier),
      redirectUri: `http://127.0.0.1:${redirectPort}/callback`,
      state: `state-${redirectPort}`
    }
  });
  assert.equal(start.statusCode, 200);
  const requestId = (start.json() as { requestId: string }).requestId;

  const bridge = await app.inject({
    method: "GET",
    url: `/auth/verifier/device/bridge?requestId=${encodeURIComponent(requestId)}`,
    headers: {
      cookie
    }
  });
  assert.equal(bridge.statusCode, 302);
  const callbackUrl = new URL(String(bridge.headers.location ?? ""));
  const code = callbackUrl.searchParams.get("code");
  assert.ok(code);

  const exchange = await app.inject({
    method: "POST",
    url: "/auth/verifier/device/exchange",
    payload: {
      requestId,
      code,
      codeVerifier
    }
  });
  assert.equal(exchange.statusCode, 200);
  const body = exchange.json() as {
    accessToken: string;
    user?: { id: string };
  };
  assert.ok(body.accessToken.startsWith("vka_"));
  assert.ok(body.user?.id);
  return {
    accessToken: body.accessToken,
    userId: body.user?.id ?? ""
  };
}

async function importRoster(accessToken: string, uid: string, region: "EU" | "NA"): Promise<void> {
  const rankedPool = [
    "agent_ellen",
    "agent_lycaon",
    "agent_nicole",
    "agent_anby",
    "agent_billy",
    "agent_zhu_yuan",
    "agent_grace",
    "agent_anton",
    "agent_ben",
    "agent_koleda",
    "agent_rina",
    "agent_soldier_11"
  ];
  const rosterImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    payload: {
      uid,
      region,
      fullSync: false,
      agents: rankedPool.map((agentId) => ({
        agentId,
        owned: true,
        level: 60
      }))
    }
  });
  assert.equal(rosterImport.statusCode, 200);
}

async function ensureMatchCreated(cookieA: string, cookieB: string): Promise<string> {
  const joinA = await app.inject({
    method: "POST",
    url: "/matchmaking/join",
    headers: { cookie: cookieA },
    payload: { queueId: "queue_standard_weekly" }
  });
  assert.equal(joinA.statusCode, 200);
  const joinABody = joinA.json() as { match?: { id: string } };
  if (joinABody.match?.id) {
    return joinABody.match.id;
  }

  const joinB = await app.inject({
    method: "POST",
    url: "/matchmaking/join",
    headers: { cookie: cookieB },
    payload: { queueId: "queue_standard_weekly" }
  });
  assert.equal(joinB.statusCode, 200);
  const joinBBody = joinB.json() as { match?: { id: string } };
  if (joinBBody.match?.id) {
    return joinBBody.match.id;
  }

  const statusA = await app.inject({
    method: "GET",
    url: "/matchmaking/status?queueId=queue_standard_weekly",
    headers: { cookie: cookieA }
  });
  assert.equal(statusA.statusCode, 200);
  const statusABody = statusA.json() as { match?: { id: string } };
  if (statusABody.match?.id) {
    return statusABody.match.id;
  }

  throw new Error("Failed to create matchmaking match.");
}

async function completeDraftToPrecheck(
  matchId: string,
  cookieA: string,
  cookieB: string
): Promise<{ userAId: string; userBId: string }> {
  const meA = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: { cookie: cookieA }
  });
  const meB = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: { cookie: cookieB }
  });
  assert.equal(meA.statusCode, 200);
  assert.equal(meB.statusCode, 200);
  const userAId = (meA.json() as { id: string }).id;
  const userBId = (meB.json() as { id: string }).id;

  const checkinA = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/checkin`,
    headers: { cookie: cookieA }
  });
  const checkinB = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/checkin`,
    headers: { cookie: cookieB }
  });
  assert.equal(checkinA.statusCode, 200);
  assert.equal(checkinB.statusCode, 200);

  const draftAgentPool = [
    "agent_ellen",
    "agent_lycaon",
    "agent_nicole",
    "agent_anby",
    "agent_billy",
    "agent_zhu_yuan",
    "agent_grace",
    "agent_anton",
    "agent_ben",
    "agent_koleda",
    "agent_rina",
    "agent_soldier_11"
  ];

  for (let guard = 0; guard < 16; guard += 1) {
    const matchResponse = await app.inject({
      method: "GET",
      url: `/matches/${encodeURIComponent(matchId)}`,
      headers: { cookie: cookieA }
    });
    assert.equal(matchResponse.statusCode, 200);
    const match = matchResponse.json() as {
      state: string;
      players: Array<{ side: "A" | "B"; userId: string }>;
      draft: {
        sequence: string[];
        actions: Array<{ agentId: string }>;
      };
    };

    if (match.state !== "DRAFTING") {
      break;
    }
    const nextType = match.draft.sequence[match.draft.actions.length];
    assert.ok(nextType);
    const side = nextType.endsWith("_A") ? "A" : "B";
    const actorUserId = match.players.find((item) => item.side === side)?.userId;
    assert.ok(actorUserId);
    const taken = new Set(match.draft.actions.map((action) => action.agentId));
    const agentId = draftAgentPool.find((candidate) => !taken.has(candidate));
    assert.ok(agentId);
    const actorCookie = actorUserId === userAId ? cookieA : cookieB;
    const draftAction = await app.inject({
      method: "POST",
      url: `/matches/${encodeURIComponent(matchId)}/draft/action`,
      headers: { cookie: actorCookie },
      payload: { type: nextType, agentId }
    });
    assert.equal(draftAction.statusCode, 200);
  }

  const finalMatch = await app.inject({
    method: "GET",
    url: `/matches/${encodeURIComponent(matchId)}`,
    headers: { cookie: cookieA }
  });
  assert.equal(finalMatch.statusCode, 200);
  const finalState = (finalMatch.json() as { state: string }).state;
  assert.equal(finalState, "AWAITING_PRECHECK");

  return { userAId, userBId };
}

function readCookie(headers: Record<string, unknown>): string {
  const setCookie = headers["set-cookie"];
  if (!setCookie) {
    throw new Error("Expected set-cookie header");
  }
  const raw = Array.isArray(setCookie) ? String(setCookie[0]) : String(setCookie);
  return raw.split(";")[0] ?? raw;
}

before(async () => {
  process.env.IKA_REPOSITORY = "memory";
  delete process.env.AUTH_DISABLED;
  process.env.SESSION_SECRET = "test-secret";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:4000/auth/google/callback";
  app = await createApp({
    logger: false,
    disableBackgroundJobs: true
  });
});

after(async () => {
  if (originalRepository === undefined) {
    delete process.env.IKA_REPOSITORY;
  } else {
    process.env.IKA_REPOSITORY = originalRepository;
  }
  if (originalAuthDisabled === undefined) {
    delete process.env.AUTH_DISABLED;
  } else {
    process.env.AUTH_DISABLED = originalAuthDisabled;
  }
  if (originalSessionSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalSessionSecret;
  }
  if (originalGoogleClientId === undefined) {
    delete process.env.GOOGLE_CLIENT_ID;
  } else {
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  }
  if (originalGoogleClientSecret === undefined) {
    delete process.env.GOOGLE_CLIENT_SECRET;
  } else {
    process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
  }
  if (originalGoogleRedirectUri === undefined) {
    delete process.env.GOOGLE_REDIRECT_URI;
  } else {
    process.env.GOOGLE_REDIRECT_URI = originalGoogleRedirectUri;
  }
  await app.close();
});

test("verifier device auth exchange issues bearer token accepted by auth and roster import", async () => {
  const register = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "verifier-flow@test.dev",
      password: "super-secure-pass",
      displayName: "VerifierFlow"
    }
  });
  assert.equal(register.statusCode, 200);
  const cookie = readCookie(register.headers as Record<string, unknown>);

  const codeVerifier = "verifier-code-1234567890-abcdefghijklmnopqrstuvwxyz";
  const codeChallenge = createCodeChallenge(codeVerifier);
  const start = await app.inject({
    method: "POST",
    url: "/auth/verifier/device/start",
    payload: {
      codeChallenge,
      redirectUri: "http://127.0.0.1:53127/callback",
      state: "test-state"
    }
  });
  assert.equal(start.statusCode, 200);
  const startBody = start.json() as {
    requestId: string;
  };
  assert.ok(startBody.requestId);

  const bridge = await app.inject({
    method: "GET",
    url: `/auth/verifier/device/bridge?requestId=${encodeURIComponent(startBody.requestId)}`,
    headers: {
      cookie
    }
  });
  assert.equal(bridge.statusCode, 302);
  const location = String(bridge.headers.location ?? "");
  assert.ok(location.startsWith("http://127.0.0.1:53127/callback"));
  const callbackUrl = new URL(location);
  const code = callbackUrl.searchParams.get("code");
  const requestId = callbackUrl.searchParams.get("requestId");
  assert.ok(code);
  assert.equal(requestId, startBody.requestId);
  assert.equal(callbackUrl.searchParams.get("state"), "test-state");

  const exchange = await app.inject({
    method: "POST",
    url: "/auth/verifier/device/exchange",
    payload: {
      requestId,
      code,
      codeVerifier
    }
  });
  assert.equal(exchange.statusCode, 200);
  const exchangeBody = exchange.json() as {
    accessToken: string;
    refreshToken: string;
  };
  assert.ok(exchangeBody.accessToken.startsWith("vka_"));
  assert.ok(exchangeBody.refreshToken.startsWith("vkr_"));

  const me = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      authorization: `Bearer ${exchangeBody.accessToken}`
    }
  });
  assert.equal(me.statusCode, 200);

  const rosterImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${exchangeBody.accessToken}`
    },
    payload: {
      uid: "123456789",
      region: "EU",
      fullSync: false,
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(rosterImport.statusCode, 200);
});

test("verifier roster import surfaces degraded OCR summaries", async () => {
  const cookie = await registerAndGetCookie("verifier-degraded@test.dev", "VerifierDegraded");
  const token = await issueVerifierToken(cookie, 53129);

  const rosterImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "987654321",
      region: "EU",
      fullSync: false,
      lowConfReasons: ["agent_anby.weapon_missing", "equipment_low_confidence"],
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(rosterImport.statusCode, 200);
  const body = rosterImport.json() as {
    summary?: { status?: string; message?: string };
  };
  assert.equal(body.summary?.status, "DEGRADED");
  assert.match(body.summary?.message ?? "", /low confidence/i);
});

test("verifier roster import preserves rich OCR contract fields", async () => {
  const cookie = await registerAndGetCookie("verifier-rich@test.dev", "VerifierRich");
  const token = await issueVerifierToken(cookie, 53130);

  const rosterImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "555666777",
      region: "EU",
      fullSync: false,
      modelVersion: "ocr-v2.1.0",
      dataVersion: "dataset-2026-03-10",
      scanMeta: "capture=inventory;pass=1",
      timingMs: 842.5,
      resolution: "1920x1080",
      locale: "en-US",
      lowConfReasons: ["agent_anby.disc_slot_2_missing"],
      confidenceByField: {
        uid: 0.998,
        roster: 0.973
      },
      fieldSources: {
        uid: "ocr.uid_panel",
        roster: "ocr.agent_overview"
      },
      capabilities: {
        fullRosterCoverage: false,
        equipmentFromPixels: true
      },
      agents: [
        {
          agentId: "agent_anby",
          owned: true,
          level: 50,
          levelCap: 60,
          mindscape: 1,
          mindscapeCap: 6,
          stats: {
            hp: 10543,
            atk: 2487,
            impact: 118
          },
          weapon: {
            weaponId: "weapon_demara_battery_mark_ii",
            displayName: "Demara Battery Mark II",
            level: 50,
            levelCap: 60,
            baseStatKey: "atk",
            baseStatValue: 624,
            advancedStatKey: "impact",
            advancedStatValue: 18
          },
          weaponPresent: true,
          discSlotOccupancy: {
            "1": true,
            "2": false
          },
          discs: [
            {
              slot: 1,
              setId: "discset_woodpecker_electro",
              displayName: "Woodpecker Electro [1]",
              level: 15,
              levelCap: 15,
              mainStatKey: "atk_percent",
              mainStatValue: 30.4,
              substats: [
                {
                  key: "crit_rate",
                  value: 8
                },
                {
                  key: "hp_flat",
                  value: 112
                }
              ]
            }
          ],
          confidenceByField: {
            level: 0.994,
            weapon: 0.965,
            disc_1: 0.941
          },
          fieldSources: {
            level: "ocr.agent_panel.level",
            weapon: "ocr.weapon_panel",
            disc_1: "ocr.disc_slot_1"
          }
        }
      ]
    }
  });
  assert.equal(rosterImport.statusCode, 200);

  const rosterResponse = await app.inject({
    method: "GET",
    url: "/players/555666777/roster?region=EU"
  });
  assert.equal(rosterResponse.statusCode, 200);

  const roster = rosterResponse.json() as {
    agents: Array<{
      agent: { agentId: string };
      state?: {
        level?: number;
        levelCap?: number;
        mindscape?: number;
        mindscapeCap?: number;
        stats?: Record<string, number>;
        weaponPresent?: boolean;
        discSlotOccupancy?: Record<string, boolean>;
        confidenceByField?: Record<string, number>;
        confidence?: Record<string, number>;
        fieldSources?: Record<string, string>;
        weapon?: {
          weaponId?: string;
          displayName?: string;
          level?: number;
          levelCap?: number;
          baseStatKey?: string;
          baseStatValue?: number;
          advancedStatKey?: string;
          advancedStatValue?: number;
        };
        discs?: Array<{
          slot?: number;
          setId?: string;
          displayName?: string;
          level?: number;
          levelCap?: number;
          mainStatKey?: string;
          mainStatValue?: number;
          substats?: Array<{ key?: string; value?: number }>;
        }>;
      };
    }>;
    lastImport?: {
      status?: string;
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
    };
  };

  const anby = roster.agents.find((entry) => entry.agent.agentId === "agent_anby");
  assert.ok(anby?.state);
  assert.equal(anby.state.level, 50);
  assert.equal(anby.state.levelCap, 60);
  assert.equal(anby.state.mindscape, 1);
  assert.equal(anby.state.mindscapeCap, 6);
  assert.deepEqual(anby.state.stats, {
    hp: 10543,
    atk: 2487,
    impact: 118
  });
  assert.equal(anby.state.weaponPresent, true);
  assert.deepEqual(anby.state.discSlotOccupancy, {
    "1": true,
    "2": false
  });
  assert.deepEqual(anby.state.confidenceByField, {
    level: 0.994,
    weapon: 0.965,
    disc_1: 0.941
  });
  assert.deepEqual(anby.state.confidence, {
    level: 0.994,
    weapon: 0.965,
    disc_1: 0.941
  });
  assert.deepEqual(anby.state.fieldSources, {
    level: "ocr.agent_panel.level",
    weapon: "ocr.weapon_panel",
    disc_1: "ocr.disc_slot_1"
  });
  assert.deepEqual(anby.state.weapon, {
    weaponId: "weapon_demara_battery_mark_ii",
    displayName: "Demara Battery Mark II",
    level: 50,
    levelCap: 60,
    baseStatKey: "atk",
    baseStatValue: 624,
    advancedStatKey: "impact",
    advancedStatValue: 18
  });
  assert.deepEqual(anby.state.discs, [
    {
      slot: 1,
      setId: "discset_woodpecker_electro",
      displayName: "Woodpecker Electro [1]",
      level: 15,
      levelCap: 15,
      mainStatKey: "atk_percent",
      mainStatValue: 30.4,
      substats: [
        {
          key: "crit_rate",
          value: 8
        },
        {
          key: "hp_flat",
          value: 112
        }
      ]
    }
  ]);

  assert.equal(roster.lastImport?.status, "DEGRADED");
  assert.equal(roster.lastImport?.modelVersion, "ocr-v2.1.0");
  assert.equal(roster.lastImport?.dataVersion, "dataset-2026-03-10");
  assert.equal(roster.lastImport?.scanMeta, "capture=inventory;pass=1");
  assert.equal(roster.lastImport?.timingMs, 842.5);
  assert.equal(roster.lastImport?.resolution, "1920x1080");
  assert.equal(roster.lastImport?.locale, "en-US");
  assert.deepEqual(roster.lastImport?.lowConfReasons, ["agent_anby.disc_slot_2_missing"]);
  assert.deepEqual(roster.lastImport?.confidenceByField, {
    uid: 0.998,
    roster: 0.973
  });
  assert.deepEqual(roster.lastImport?.fieldSources, {
    uid: "ocr.uid_panel",
    roster: "ocr.agent_overview"
  });
  assert.deepEqual(roster.lastImport?.capabilities, {
    fullRosterCoverage: false,
    equipmentFromPixels: true
  });
});

test("verifier roster import falls back to linked UID when payload uid is missing or invalid", async () => {
  const cookie = await registerAndGetCookie("verifier-fallback@test.dev", "VerifierFallback");
  const token = await issueVerifierToken(cookie, 53137);

  await importRoster(token.accessToken, "888999000", "EU");

  const fallbackImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "invalid",
      region: "EU",
      fullSync: false,
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(fallbackImport.statusCode, 200);
  const fallbackBody = fallbackImport.json() as { verification?: { uid?: string } };
  assert.equal(fallbackBody.verification?.uid, "888999000");
});

test("verifier roster import still rejects mismatched linked UID", async () => {
  const cookie = await registerAndGetCookie("verifier-fallback-mismatch@test.dev", "VerifierFallbackMismatch");
  const token = await issueVerifierToken(cookie, 53138);

  await importRoster(token.accessToken, "777888999", "EU");

  const mismatch = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "000111222",
      region: "EU",
      fullSync: false,
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(mismatch.statusCode, 403);
  assert.deepEqual(mismatch.json(), {
    error: "UID mismatch with linked account",
    code: "UID_MISMATCH_LINKED_ACCOUNT"
  });
});

test("verifier fullSync rejects payloads without full roster coverage", async () => {
  const cookie = await registerAndGetCookie("vfsguard1@test.dev", "VerifierFullSyncGuard1");
  const token = await issueVerifierToken(cookie, 53133);

  const rosterImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "222333444",
      region: "EU",
      fullSync: true,
      capabilities: {
        fullRosterCoverage: false
      },
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(rosterImport.statusCode, 409);
  assert.deepEqual(rosterImport.json(), {
    error: "Verifier fullSync requires capabilities.fullRosterCoverage=true.",
    code: "FULLSYNC_REQUIRES_FULL_ROSTER_COVERAGE"
  });
});

test("verifier fullSync rejects payloads that omit full roster coverage capability", async () => {
  const cookie = await registerAndGetCookie("vfsguard2@test.dev", "VerifierFullSyncGuard2");
  const token = await issueVerifierToken(cookie, 53134);

  const rosterImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "333444555",
      region: "EU",
      fullSync: true,
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(rosterImport.statusCode, 409);
  assert.deepEqual(rosterImport.json(), {
    error: "Verifier fullSync requires capabilities.fullRosterCoverage=true.",
    code: "FULLSYNC_REQUIRES_FULL_ROSTER_COVERAGE"
  });
});

test("verifier fullSync preserves existing roster when coverage guard rejects overwrite", async () => {
  const cookie = await registerAndGetCookie("vfsguard3@test.dev", "VerifierFullSyncGuard3");
  const token = await issueVerifierToken(cookie, 53135);

  const partialImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "444555777",
      region: "EU",
      fullSync: false,
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(partialImport.statusCode, 200);

  const rejectedFullSync = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "444555777",
      region: "EU",
      fullSync: true,
      capabilities: {
        fullRosterCoverage: false
      },
      agents: [{ agentId: "agent_billy", owned: true, level: 50 }]
    }
  });
  assert.equal(rejectedFullSync.statusCode, 409);

  const rosterResponse = await app.inject({
    method: "GET",
    url: "/players/444555777/roster?region=EU"
  });
  assert.equal(rosterResponse.statusCode, 200);
  const roster = rosterResponse.json() as {
    agents: Array<{
      agent: { agentId: string };
      state?: { owned?: boolean; level?: number };
    }>;
  };

  const anby = roster.agents.find((entry) => entry.agent.agentId === "agent_anby");
  const billy = roster.agents.find((entry) => entry.agent.agentId === "agent_billy");
  assert.equal(anby?.state?.owned, true);
  assert.equal(anby?.state?.level, 60);
  assert.equal(billy?.state, undefined);
});

test("verifier fullSync accepts payloads that declare full roster coverage", async () => {
  const cookie = await registerAndGetCookie("vfsguard4@test.dev", "VerifierFullSyncGuard4");
  const token = await issueVerifierToken(cookie, 53136);

  const rosterImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "666777888",
      region: "EU",
      fullSync: true,
      capabilities: {
        fullRosterCoverage: true,
        equipmentFromPixels: true
      },
      agents: [{ agentId: "agent_anby", owned: true, level: 60 }]
    }
  });
  assert.equal(rosterImport.statusCode, 200);
  const body = rosterImport.json() as {
    summary?: { message?: string; capabilities?: Record<string, boolean> };
  };
  assert.equal(body.summary?.message, "Verifier full roster sync completed.");
  assert.deepEqual(body.summary?.capabilities, {
    fullRosterCoverage: true,
    equipmentFromPixels: true
  });

  const rosterResponse = await app.inject({
    method: "GET",
    url: "/players/666777888/roster?region=EU"
  });
  assert.equal(rosterResponse.statusCode, 200);
  const roster = rosterResponse.json() as {
    agents: Array<{
      agent: { agentId: string };
      state?: { owned?: boolean; level?: number };
    }>;
  };

  const anby = roster.agents.find((entry) => entry.agent.agentId === "agent_anby");
  const billy = roster.agents.find((entry) => entry.agent.agentId === "agent_billy");
  assert.equal(anby?.state?.owned, true);
  assert.equal(anby?.state?.level, 60);
  assert.equal(billy?.state?.owned, false);
});

test("verifier fullSync preserves existing detailed fields when payload omits them", async () => {
  const cookie = await registerAndGetCookie("vfsguard5@test.dev", "VerifierFullSyncGuard5");
  const token = await issueVerifierToken(cookie, 53137);

  const initialImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "777888999",
      region: "EU",
      fullSync: false,
      agents: [
        {
          agentId: "agent_anby",
          owned: true,
          level: 50,
          weapon: {
            weaponId: "weapon_demara_battery_mark_ii",
            displayName: "Demara Battery Mark II",
            level: 50,
            levelCap: 60
          },
          weaponPresent: true,
          discs: [
            {
              slot: 1,
              setId: "discset_woodpecker_electro",
              displayName: "Woodpecker Electro [1]",
              level: 15
            }
          ],
          discSlotOccupancy: {
            "1": true
          },
          stats: {
            hp: 10001,
            atk: 2500
          }
        }
      ]
    }
  });
  assert.equal(initialImport.statusCode, 200);

  const followupImport = await app.inject({
    method: "POST",
    url: "/verifier/roster/import",
    headers: {
      authorization: `Bearer ${token.accessToken}`
    },
    payload: {
      uid: "777888999",
      region: "EU",
      fullSync: true,
      capabilities: {
        fullRosterCoverage: true
      },
      agents: [
        {
          agentId: "agent_anby",
          owned: true,
          level: 60
        }
      ]
    }
  });
  assert.equal(followupImport.statusCode, 200);

  const rosterResponse = await app.inject({
    method: "GET",
    url: "/players/777888999/roster?region=EU"
  });
  assert.equal(rosterResponse.statusCode, 200);
  const roster = rosterResponse.json() as {
    agents: Array<{
      agent: { agentId: string };
      state?: {
        owned?: boolean;
        level?: number;
        weaponPresent?: boolean;
        stats?: Record<string, number>;
        weapon?: { weaponId?: string; level?: number; levelCap?: number };
        discs?: Array<{ slot?: number; setId?: string; level?: number }>;
        discSlotOccupancy?: Record<string, boolean>;
      };
    }>;
  };

  const anby = roster.agents.find((entry) => entry.agent.agentId === "agent_anby");
  assert.equal(anby?.state?.owned, true);
  assert.equal(anby?.state?.level, 60);
  assert.equal(anby?.state?.weaponPresent, true);
  assert.deepEqual(anby?.state?.stats, {
    hp: 10001,
    atk: 2500
  });
  assert.deepEqual(anby?.state?.weapon, {
    weaponId: "weapon_demara_battery_mark_ii",
    displayName: "Demara Battery Mark II",
    level: 50,
    levelCap: 60
  });
  assert.deepEqual(anby?.state?.discs, [
    {
      slot: 1,
      setId: "discset_woodpecker_electro",
      displayName: "Woodpecker Electro [1]",
      level: 15
    }
  ]);
  assert.deepEqual(anby?.state?.discSlotOccupancy, {
    "1": true
  });
});

test("verifier refresh rotates tokens and revoked token cannot be reused", async () => {
  const register = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "verifier-refresh@test.dev",
      password: "super-secure-pass",
      displayName: "VerifierRefresh"
    }
  });
  assert.equal(register.statusCode, 200);
  const cookie = readCookie(register.headers as Record<string, unknown>);

  const codeVerifier = "refresh-code-1234567890-abcdefghijklmnopqrstuvwxyz";
  const start = await app.inject({
    method: "POST",
    url: "/auth/verifier/device/start",
    payload: {
      codeChallenge: createCodeChallenge(codeVerifier),
      redirectUri: "http://127.0.0.1:53128/callback"
    }
  });
  assert.equal(start.statusCode, 200);
  const requestId = (start.json() as { requestId: string }).requestId;

  const bridge = await app.inject({
    method: "GET",
    url: `/auth/verifier/device/bridge?requestId=${encodeURIComponent(requestId)}`,
    headers: {
      cookie
    }
  });
  assert.equal(bridge.statusCode, 302);
  const callbackUrl = new URL(String(bridge.headers.location ?? ""));
  const code = callbackUrl.searchParams.get("code");
  assert.ok(code);

  const exchange = await app.inject({
    method: "POST",
    url: "/auth/verifier/device/exchange",
    payload: {
      requestId,
      code,
      codeVerifier
    }
  });
  assert.equal(exchange.statusCode, 200);
  const issued = exchange.json() as { accessToken: string; refreshToken: string };

  const refresh = await app.inject({
    method: "POST",
    url: "/auth/verifier/token/refresh",
    payload: {
      refreshToken: issued.refreshToken
    }
  });
  assert.equal(refresh.statusCode, 200);
  const refreshed = refresh.json() as { accessToken: string; refreshToken: string };
  assert.notEqual(refreshed.accessToken, issued.accessToken);
  assert.notEqual(refreshed.refreshToken, issued.refreshToken);

  const reuseOldRefresh = await app.inject({
    method: "POST",
    url: "/auth/verifier/token/refresh",
    payload: {
      refreshToken: issued.refreshToken
    }
  });
  assert.equal(reuseOldRefresh.statusCode, 401);

  const revoke = await app.inject({
    method: "POST",
    url: "/auth/verifier/token/revoke",
    payload: {
      token: refreshed.accessToken
    }
  });
  assert.equal(revoke.statusCode, 200);

  const meAfterRevoke = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      authorization: `Bearer ${refreshed.accessToken}`
    }
  });
  assert.equal(meAfterRevoke.statusCode, 401);
});

test("verifier precheck enforces user-bound signatures, nonce replay checks, and LOW_CONF acceptance", async () => {
  const cookieA = await registerAndGetCookie("verifier-evidence-a@test.dev", "VerifierEvidenceA");
  const cookieB = await registerAndGetCookie("verifier-evidence-b@test.dev", "VerifierEvidenceB");

  const tokenA = await issueVerifierToken(cookieA, 53131);
  const tokenB = await issueVerifierToken(cookieB, 53132);
  await importRoster(tokenA.accessToken, "111222333", "EU");
  await importRoster(tokenB.accessToken, "444555666", "NA");

  const matchId = await ensureMatchCreated(cookieA, cookieB);
  const { userAId, userBId } = await completeDraftToPrecheck(matchId, cookieA, cookieB);

  const cookieSession = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/verifier/session`,
    headers: { cookie: cookieA }
  });
  assert.equal(cookieSession.statusCode, 401);
  assert.equal((cookieSession.json() as { code: string }).code, "VERIFIER_AUTH_REQUIRED");

  const session = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/verifier/session`,
    headers: {
      authorization: `Bearer ${tokenA.accessToken}`
    }
  });
  assert.equal(session.statusCode, 200);
  const sessionBody = session.json() as {
    verifierSessionToken: string;
    expectedAgents?: string[];
    bannedAgents?: string[];
  };
  const verifierSessionToken = sessionBody.verifierSessionToken;
  assert.ok(verifierSessionToken);
  assert.ok(Array.isArray(sessionBody.expectedAgents));
  assert.ok((sessionBody.expectedAgents?.length ?? 0) > 0);
  assert.ok(Array.isArray(sessionBody.bannedAgents));
  assert.ok((sessionBody.bannedAgents?.length ?? 0) > 0);

  const frameHashInvalid = "frame-invalid-signature";
  const nonceInvalid = "nonce-invalid-signature";
  const wrongUserSignature = createEvidenceSignature({
    matchId,
    userId: userBId,
    type: "PRECHECK",
    detectedAgents: ["agent_anby", "agent_nicole", "agent_ellen"],
    confidence: { agent_anby: 0.9, agent_nicole: 0.9, agent_ellen: 0.9 },
    result: "PASS",
    frameHash: frameHashInvalid,
    nonce: nonceInvalid,
    token: verifierSessionToken
  });
  const invalidSignature = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/evidence/precheck`,
    headers: {
      authorization: `Bearer ${tokenA.accessToken}`
    },
    payload: {
      detectedAgents: ["agent_anby", "agent_nicole", "agent_ellen"],
      confidence: { agent_anby: 0.9, agent_nicole: 0.9, agent_ellen: 0.9 },
      result: "PASS",
      frameHash: frameHashInvalid,
      verifierSessionToken,
      verifierNonce: nonceInvalid,
      verifierSignature: wrongUserSignature
    }
  });
  assert.equal(invalidSignature.statusCode, 401);
  assert.equal((invalidSignature.json() as { code: string }).code, "INVALID_SIGNATURE");

  const frameHashLowConf = "frame-low-conf";
  const nonceLowConf = "nonce-low-conf";
  const cookieOnlyEvidence = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/evidence/precheck`,
    headers: { cookie: cookieA },
    payload: {
      detectedAgents: ["agent_anby", "agent_nicole"],
      confidence: { agent_anby: 0.78, agent_nicole: 0.76 },
      result: "LOW_CONF",
      frameHash: frameHashLowConf,
      verifierSessionToken,
      verifierNonce: nonceLowConf,
      verifierSignature: "ignored"
    }
  });
  assert.equal(cookieOnlyEvidence.statusCode, 401);
  assert.equal((cookieOnlyEvidence.json() as { code: string }).code, "VERIFIER_AUTH_REQUIRED");

  const lowConfSignature = createEvidenceSignature({
    matchId,
    userId: userAId,
    type: "PRECHECK",
    detectedAgents: ["agent_anby", "agent_nicole"],
    confidence: { agent_anby: 0.78, agent_nicole: 0.76 },
    result: "LOW_CONF",
    frameHash: frameHashLowConf,
    nonce: nonceLowConf,
    token: verifierSessionToken
  });
  const lowConf = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/evidence/precheck`,
    headers: {
      authorization: `Bearer ${tokenA.accessToken}`
    },
    payload: {
      detectedAgents: ["agent_anby", "agent_nicole"],
      confidence: { agent_anby: 0.78, agent_nicole: 0.76 },
      result: "LOW_CONF",
      frameHash: frameHashLowConf,
      verifierSessionToken,
      verifierNonce: nonceLowConf,
      verifierSignature: lowConfSignature
    }
  });
  assert.equal(lowConf.statusCode, 200);
  assert.equal((lowConf.json() as { verifierDecisionCode: string }).verifierDecisionCode, "LOW_CONF_ACCEPTED");

  const frameHashPass = "frame-pass";
  const replayNonce = "nonce-replay";
  const replaySignature = createEvidenceSignature({
    matchId,
    userId: userAId,
    type: "PRECHECK",
    detectedAgents: ["agent_anby", "agent_nicole", "agent_ellen"],
    confidence: { agent_anby: 0.95, agent_nicole: 0.94, agent_ellen: 0.95 },
    result: "PASS",
    frameHash: frameHashPass,
    nonce: replayNonce,
    token: verifierSessionToken
  });
  const firstPass = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/evidence/precheck`,
    headers: {
      authorization: `Bearer ${tokenA.accessToken}`
    },
    payload: {
      detectedAgents: ["agent_anby", "agent_nicole", "agent_ellen"],
      confidence: { agent_anby: 0.95, agent_nicole: 0.94, agent_ellen: 0.95 },
      result: "PASS",
      frameHash: frameHashPass,
      verifierSessionToken,
      verifierNonce: replayNonce,
      verifierSignature: replaySignature
    }
  });
  assert.equal(firstPass.statusCode, 200);

  const replay = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/evidence/precheck`,
    headers: {
      authorization: `Bearer ${tokenA.accessToken}`
    },
    payload: {
      detectedAgents: ["agent_anby", "agent_nicole", "agent_ellen"],
      confidence: { agent_anby: 0.95, agent_nicole: 0.94, agent_ellen: 0.95 },
      result: "PASS",
      frameHash: frameHashPass,
      verifierSessionToken,
      verifierNonce: replayNonce,
      verifierSignature: replaySignature
    }
  });
  assert.equal(replay.statusCode, 409);
  assert.equal((replay.json() as { code: string }).code, "NONCE_REPLAY");

  const tamperedAgents = await app.inject({
    method: "POST",
    url: `/matches/${encodeURIComponent(matchId)}/evidence/precheck`,
    headers: {
      authorization: `Bearer ${tokenA.accessToken}`
    },
    payload: {
      detectedAgents: ["agent_anby", "agent_nicole", "agent_billy"],
      confidence: { agent_anby: 0.95, agent_nicole: 0.94, agent_billy: 0.95 },
      result: "PASS",
      frameHash: "frame-tampered",
      verifierSessionToken,
      verifierNonce: "nonce-tampered",
      verifierSignature: createEvidenceSignature({
        matchId,
        userId: userAId,
        type: "PRECHECK",
        detectedAgents: ["agent_anby", "agent_nicole", "agent_ellen"],
        confidence: { agent_anby: 0.95, agent_nicole: 0.94, agent_ellen: 0.95 },
        result: "PASS",
        frameHash: "frame-tampered",
        nonce: "nonce-tampered",
        token: verifierSessionToken
      })
    }
  });
  assert.equal(tamperedAgents.statusCode, 401);
  assert.equal((tamperedAgents.json() as { code: string }).code, "INVALID_SIGNATURE");
});
