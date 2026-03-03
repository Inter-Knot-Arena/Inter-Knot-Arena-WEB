import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
