import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Repository, VerifierDeviceRequest, VerifierTokenRecord } from "../repository/types.js";
import { createId, now, requireString } from "../utils.js";
import {
  buildDefaultUser,
  ensureAuthReady,
  ensureSessionSecret,
  getAuthUser,
  getVerifierBearerToken,
  resolveRedirect,
  type AuthContext
} from "../auth/context.js";
import {
  buildGoogleAuthUrl,
  createCodeChallenge,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  parseIdTokenPayload
} from "../auth/google.js";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createCodeVerifier,
  getSessionFromRequest,
  setSessionCookie
} from "../auth/session.js";
import { hashPassword, isValidEmail, normalizeEmail, verifyPassword } from "../auth/password.js";
import type { Region, Role, User } from "@ika/shared";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

function createSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function isValidPkceChallenge(value: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

function resolveLoopbackRedirect(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("redirectUri must be an absolute URL");
  }
  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === "127.0.0.1" || host === "localhost";
  if (parsed.protocol !== "http:" || !isLoopback) {
    throw new Error("redirectUri must use http://127.0.0.1 or http://localhost");
  }
  return parsed;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  repo: Repository,
  auth: AuthContext
) {
  const allowedRegions: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => normalizeEmail(value.trim()))
      .filter(Boolean)
  );

  const applyAdminRole = (email: string, roles: Role[]): Role[] => {
    if (!adminEmails.has(normalizeEmail(email))) {
      return roles;
    }
    return roles.includes("ADMIN") ? roles : [...roles, "ADMIN"];
  };

  const resolveRegion = (value: unknown, fallback: Region): Region => {
    if (typeof value !== "string") {
      return fallback;
    }
    return allowedRegions.includes(value as Region) ? (value as Region) : fallback;
  };

  const redirectToGoogleLogin = (redirectTo: string, reply: { redirect: (url: string) => void }) => {
    ensureAuthReady(auth);
    const state = createId("state");
    const codeVerifier = createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);
    const nonce = createId("nonce");

    auth.stateStore.save(state, {
      codeVerifier,
      redirectTo,
      nonce,
      createdAt: now()
    });

    const url = buildGoogleAuthUrl({
      clientId: auth.config.googleClientId,
      redirectUri: auth.config.googleRedirectUri,
      state,
      codeChallenge,
      nonce,
      prompt: "select_account"
    });
    reply.redirect(url);
  };

  app.get("/auth/google/start", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.send({ url: resolveRedirect(undefined, auth.config.webOrigin) });
        return;
      }
      ensureAuthReady(auth);

      const query = request.query as { redirect?: string };
      const redirectTo = resolveRedirect(query?.redirect, auth.config.webOrigin);
      const state = createId("state");
      const codeVerifier = createCodeVerifier();
      const codeChallenge = createCodeChallenge(codeVerifier);
      const nonce = createId("nonce");

      auth.stateStore.save(state, {
        codeVerifier,
        redirectTo,
        nonce,
        createdAt: now()
      });

      const url = buildGoogleAuthUrl({
        clientId: auth.config.googleClientId,
        redirectUri: auth.config.googleRedirectUri,
        state,
        codeChallenge,
        nonce,
        prompt: "select_account"
      });
      reply.send({ url });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/auth/google/callback", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.redirect(resolveRedirect(undefined, auth.config.webOrigin));
        return;
      }
      ensureAuthReady(auth);

      const query = request.query as { code?: string; state?: string };
      const code = requireString(query?.code, "code");
      const state = requireString(query?.state, "state");

      const stored = auth.stateStore.consume(state);
      if (!stored) {
        throw new Error("Invalid or expired OAuth state");
      }

      const token = await exchangeCodeForTokens({
        clientId: auth.config.googleClientId,
        clientSecret: auth.config.googleClientSecret,
        redirectUri: auth.config.googleRedirectUri,
        code,
        codeVerifier: stored.codeVerifier
      });

      if (token.id_token) {
        const payload = parseIdTokenPayload(token.id_token);
        if (!payload || payload.nonce !== stored.nonce) {
          throw new Error("Invalid OAuth nonce");
        }
      }

      if (!token.access_token) {
        throw new Error("Missing access token from Google");
      }

      const profile = await fetchGoogleProfile(token.access_token);
      if (!profile.email) {
        throw new Error("Google account has no email");
      }

      const nameFromEmail = profile.email.split("@")[0] ?? profile.email;
      const displayName = profile.name ?? nameFromEmail;
      const existingAccount = await auth.oauthStore.findByProviderAccountId("google", profile.sub);
      let user = null as Awaited<ReturnType<typeof repo.findUser>> | null;
      if (existingAccount) {
        try {
          user = await repo.findUser(existingAccount.userId);
        } catch {
          user = null;
        }
      }
      if (!user) {
        const byEmail = await repo.findUserByEmail(profile.email);
        if (byEmail) {
          user = byEmail;
        }
      }

      let resolvedUser: Awaited<ReturnType<typeof repo.findUser>>;
      if (!user) {
        const base = buildDefaultUser();
        const createdUser = {
          id: createId("user"),
          email: profile.email,
          displayName,
          avatarUrl: profile.picture ?? null,
          region: base.region,
          createdAt: base.createdAt,
          updatedAt: now(),
          roles: applyAdminRole(profile.email, base.roles),
          trustScore: base.trustScore,
          proxyLevel: base.proxyLevel,
          verification: base.verification,
          privacy: base.privacy
        };
        await repo.createUser(createdUser);
        resolvedUser = createdUser;
      } else {
        const updatedUser = {
          ...user,
          email: profile.email,
          displayName: user.displayName || displayName,
          avatarUrl: user.avatarUrl ?? profile.picture ?? null,
          roles: applyAdminRole(profile.email, user.roles),
          updatedAt: now()
        };
        await repo.saveUser(updatedUser);
        resolvedUser = updatedUser;
      }

      await auth.oauthStore.save({
        provider: "google",
        providerAccountId: profile.sub,
        userId: resolvedUser.id,
        email: profile.email,
        createdAt: now(),
        updatedAt: now()
      });

      const session = await auth.sessionStore.createSession(resolvedUser.id);
      setSessionCookie(reply, session.id, auth.config.sessionSecret, {
        secure: process.env.NODE_ENV === "production",
        ttlMs: auth.config.sessionTtlMs
      });

      reply.redirect(stored.redirectTo || `${auth.config.webOrigin}/profile/${resolvedUser.id}`);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/auth/verifier/device/start", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.code(400).send({ error: "Auth is disabled" });
        return;
      }
      const body = request.body as {
        codeChallenge?: string;
        redirectUri?: string;
        state?: string;
      };
      const codeChallenge = requireString(body?.codeChallenge, "codeChallenge");
      const redirectUri = requireString(body?.redirectUri, "redirectUri");
      if (!isValidPkceChallenge(codeChallenge)) {
        throw new Error("codeChallenge must be a valid PKCE S256 challenge");
      }
      const redirect = resolveLoopbackRedirect(redirectUri);
      const createdAt = now();
      const requestId = createId("vreq");
      const deviceRequest: VerifierDeviceRequest = {
        id: requestId,
        codeChallenge,
        redirectUri: redirect.toString(),
        state: body?.state,
        status: "PENDING",
        createdAt,
        expiresAt: createdAt + auth.config.verifierDeviceRequestTtlMs
      };
      await repo.createVerifierDeviceRequest(deviceRequest);
      reply.send({
        requestId,
        authorizeUrl: `${auth.config.apiOrigin}/auth/verifier/device/bridge?requestId=${encodeURIComponent(requestId)}`,
        expiresAt: deviceRequest.expiresAt
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/auth/verifier/device/bridge", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.code(400).send({ error: "Auth is disabled" });
        return;
      }
      const query = request.query as { requestId?: string };
      const requestId = requireString(query?.requestId, "requestId");
      const deviceRequest = await repo.findVerifierDeviceRequest(requestId);
      if (!deviceRequest) {
        reply.code(404).send({ error: "Verifier device request not found" });
        return;
      }
      const timestamp = now();
      if (deviceRequest.expiresAt <= timestamp) {
        reply.code(410).send({ error: "Verifier device request expired" });
        return;
      }
      if (deviceRequest.status === "CONSUMED") {
        reply.code(409).send({ error: "Verifier device request already consumed" });
        return;
      }

      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        const redirectTo = `${auth.config.apiOrigin}/auth/verifier/device/bridge?requestId=${encodeURIComponent(requestId)}`;
        redirectToGoogleLogin(redirectTo, reply);
        return;
      }

      const exchangeCode = createSecret("vcode");
      const authorized: VerifierDeviceRequest = {
        ...deviceRequest,
        userId: user.id,
        exchangeCode,
        status: "AUTHORIZED",
        authorizedAt: timestamp
      };
      await repo.saveVerifierDeviceRequest(authorized);

      const redirectUrl = new URL(authorized.redirectUri);
      redirectUrl.searchParams.set("code", exchangeCode);
      redirectUrl.searchParams.set("requestId", authorized.id);
      if (authorized.state) {
        redirectUrl.searchParams.set("state", authorized.state);
      }
      reply.redirect(redirectUrl.toString());
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/auth/verifier/device/exchange", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.code(400).send({ error: "Auth is disabled" });
        return;
      }
      const body = request.body as {
        requestId?: string;
        code?: string;
        codeVerifier?: string;
      };
      const requestId = requireString(body?.requestId, "requestId");
      const code = requireString(body?.code, "code");
      const codeVerifier = requireString(body?.codeVerifier, "codeVerifier");

      const deviceRequest = await repo.findVerifierDeviceRequest(requestId);
      if (!deviceRequest) {
        reply.code(401).send({ error: "Invalid verifier device request" });
        return;
      }
      if (deviceRequest.status !== "AUTHORIZED" || deviceRequest.exchangeCode !== code) {
        reply.code(401).send({ error: "Invalid verifier exchange code" });
        return;
      }
      if (deviceRequest.expiresAt <= now()) {
        reply.code(401).send({ error: "Verifier exchange code expired" });
        return;
      }
      if (createCodeChallenge(codeVerifier) !== deviceRequest.codeChallenge) {
        reply.code(401).send({ error: "Invalid codeVerifier" });
        return;
      }

      const consumed = await repo.consumeVerifierDeviceCode(requestId, code);
      if (!consumed?.userId) {
        reply.code(409).send({ error: "Verifier exchange request already consumed" });
        return;
      }

      const issuedAt = now();
      const accessToken: VerifierTokenRecord = {
        id: createId("vtoken"),
        userId: consumed.userId,
        token: createSecret("vka"),
        kind: "ACCESS",
        createdAt: issuedAt,
        expiresAt: issuedAt + auth.config.verifierAccessTokenTtlMs
      };
      const refreshToken: VerifierTokenRecord = {
        id: createId("vtoken"),
        userId: consumed.userId,
        token: createSecret("vkr"),
        kind: "REFRESH",
        createdAt: issuedAt,
        expiresAt: issuedAt + auth.config.verifierRefreshTokenTtlMs
      };
      await repo.createVerifierToken(accessToken);
      await repo.createVerifierToken(refreshToken);

      const user = await repo.findUser(consumed.userId);
      reply.send({
        tokenType: "Bearer",
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
        expiresAt: accessToken.expiresAt,
        refreshExpiresAt: refreshToken.expiresAt,
        user: {
          id: user.id,
          displayName: user.displayName,
          verification: user.verification
        }
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/auth/verifier/token/refresh", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.code(400).send({ error: "Auth is disabled" });
        return;
      }
      const body = request.body as { refreshToken?: string };
      const refreshToken = requireString(body?.refreshToken, "refreshToken");
      const current = await repo.findVerifierToken(refreshToken, "REFRESH");
      if (!current) {
        reply.code(401).send({ error: "Invalid refresh token" });
        return;
      }

      const rotatedAt = now();
      const nextAccessToken: VerifierTokenRecord = {
        id: createId("vtoken"),
        userId: current.userId,
        token: createSecret("vka"),
        kind: "ACCESS",
        createdAt: rotatedAt,
        expiresAt: rotatedAt + auth.config.verifierAccessTokenTtlMs
      };
      const nextRefreshToken: VerifierTokenRecord = {
        id: createId("vtoken"),
        userId: current.userId,
        token: createSecret("vkr"),
        kind: "REFRESH",
        createdAt: rotatedAt,
        expiresAt: rotatedAt + auth.config.verifierRefreshTokenTtlMs
      };
      const rotated = await repo.rotateVerifierToken({
        refreshToken,
        nextAccessToken,
        nextRefreshToken,
        rotatedAt
      });
      if (!rotated) {
        reply.code(401).send({ error: "Refresh token is no longer valid" });
        return;
      }
      reply.send({
        tokenType: "Bearer",
        accessToken: rotated.accessToken.token,
        refreshToken: rotated.refreshToken.token,
        expiresAt: rotated.accessToken.expiresAt,
        refreshExpiresAt: rotated.refreshToken.expiresAt
      });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/auth/verifier/token/revoke", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.code(400).send({ error: "Auth is disabled" });
        return;
      }
      const body = request.body as { token?: string; refreshToken?: string };
      const token =
        body?.token?.trim() || body?.refreshToken?.trim() || getVerifierBearerToken(request);
      if (!token) {
        reply.code(400).send({ error: "token is required" });
        return;
      }
      await repo.revokeVerifierToken(token, now());
      reply.send({ status: "ok" });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/auth/me", async (request, reply) => {
    try {
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      reply.send(user);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    try {
      const verifierBearer = getVerifierBearerToken(request);
      if (verifierBearer) {
        await repo.revokeVerifierToken(verifierBearer, now());
      }
      if (!auth.config.authDisabled) {
        ensureSessionSecret(auth);
        const session = await getSessionFromRequest(
          request,
          auth.sessionStore,
          auth.config.sessionSecret
        );
        if (session) {
          await auth.sessionStore.deleteSession(session.id);
        }
      }
      clearSessionCookie(reply, SESSION_COOKIE_NAME);
      reply.send({ status: "ok" });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/auth/register", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.code(400).send({ error: "Auth is disabled" });
        return;
      }
      ensureSessionSecret(auth);

      const body = request.body as {
        email?: string;
        password?: string;
        displayName?: string;
        region?: string;
      };
      const email = normalizeEmail(requireString(body?.email, "email"));
      const password = requireString(body?.password, "password");

      if (!isValidEmail(email)) {
        reply.code(400).send({ error: "Invalid email" });
        return;
      }
      if (password.length < auth.config.passwordMinLength) {
        reply
          .code(400)
          .send({ error: `Password must be at least ${auth.config.passwordMinLength} characters` });
        return;
      }

      let user = await repo.findUserByEmail(email);
      const existingPassword = await auth.passwordStore.findByEmail(email);
      if (existingPassword) {
        reply.code(409).send({ error: "Email already registered" });
        return;
      }

      if (!user) {
        const base = buildDefaultUser();
        const displayNameInput = typeof body?.displayName === "string" ? body.displayName.trim() : "";
        const displayName = displayNameInput || email.split("@")[0] || "Player";
        if (displayName.length > 24) {
          reply.code(400).send({ error: "Display name must be 24 characters or fewer" });
          return;
        }

        const createdUser: User = {
          id: createId("user"),
          email,
          displayName,
          avatarUrl: null,
          region: resolveRegion(body?.region, base.region),
          createdAt: base.createdAt,
          updatedAt: now(),
          roles: applyAdminRole(email, base.roles),
          trustScore: base.trustScore,
          proxyLevel: base.proxyLevel,
          verification: base.verification,
          privacy: base.privacy
        };
        await repo.createUser(createdUser);
        user = createdUser;
      } else if (body?.displayName && body.displayName.trim() !== user.displayName) {
        const trimmedName = body.displayName.trim();
        if (trimmedName.length > 24) {
          reply.code(400).send({ error: "Display name must be 24 characters or fewer" });
          return;
        }
        const updated = {
          ...user,
          displayName: trimmedName,
          roles: applyAdminRole(email, user.roles),
          updatedAt: now()
        };
        await repo.saveUser(updated);
        user = updated;
      }

      const { hash, salt } = hashPassword(password);
      await auth.passwordStore.save({
        userId: user.id,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now(),
        updatedAt: now()
      });

      const session = await auth.sessionStore.createSession(user.id);
      setSessionCookie(reply, session.id, auth.config.sessionSecret, {
        secure: process.env.NODE_ENV === "production",
        ttlMs: auth.config.sessionTtlMs
      });
      reply.send(user);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/auth/login", async (request, reply) => {
    try {
      if (auth.config.authDisabled) {
        reply.code(400).send({ error: "Auth is disabled" });
        return;
      }
      ensureSessionSecret(auth);

      const body = request.body as { email?: string; password?: string };
      const email = normalizeEmail(requireString(body?.email, "email"));
      const password = requireString(body?.password, "password");

      if (!isValidEmail(email)) {
        reply.code(400).send({ error: "Invalid email" });
        return;
      }

      const account = await auth.passwordStore.findByEmail(email);
      if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
        reply.code(401).send({ error: "Invalid credentials" });
        return;
      }

      let user = await repo.findUser(account.userId);
      const updatedRoles = applyAdminRole(user.email, user.roles);
      if (updatedRoles !== user.roles) {
        user = { ...user, roles: updatedRoles, updatedAt: now() };
        await repo.saveUser(user);
      }
      const session = await auth.sessionStore.createSession(user.id);
      setSessionCookie(reply, session.id, auth.config.sessionSecret, {
        secure: process.env.NODE_ENV === "production",
        ttlMs: auth.config.sessionTtlMs
      });
      reply.send(user);
    } catch (error) {
      sendError(reply, error);
    }
  });
}
