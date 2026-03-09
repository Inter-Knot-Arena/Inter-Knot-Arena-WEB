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
  result: "PASS" | "VIOLATION" | "LOW_CONF";
  frameHash: string;
  nonce: string;
  token: string;
}): string {
  const payload = [
    args.matchId,
    args.userId,
    args.type,
    args.result,
    args.frameHash,
    args.nonce
  ].join(":");
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
});
