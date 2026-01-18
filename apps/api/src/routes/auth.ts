import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types.js";
import { createId, now, requireString } from "../utils.js";
import {
  buildDefaultUser,
  ensureAuthReady,
  ensureSessionSecret,
  getAuthUser,
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
import type { Region, User } from "@ika/shared";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  repo: Repository,
  auth: AuthContext
) {
  const allowedRegions: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];

  const resolveRegion = (value: unknown, fallback: Region): Region => {
    if (typeof value !== "string") {
      return fallback;
    }
    return allowedRegions.includes(value as Region) ? (value as Region) : fallback;
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
      const existingAccount = auth.oauthStore.findByProviderAccountId("google", profile.sub);
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
          roles: base.roles,
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
          updatedAt: now()
        };
        await repo.saveUser(updatedUser);
        resolvedUser = updatedUser;
      }

      auth.oauthStore.save({
        provider: "google",
        providerAccountId: profile.sub,
        userId: resolvedUser.id,
        email: profile.email,
        createdAt: now(),
        updatedAt: now()
      });

      const session = auth.sessionStore.createSession(resolvedUser.id);
      setSessionCookie(reply, session.id, auth.config.sessionSecret, {
        secure: process.env.NODE_ENV === "production",
        ttlMs: auth.config.sessionTtlMs
      });

      reply.redirect(stored.redirectTo || `${auth.config.webOrigin}/profile/${resolvedUser.id}`);
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
      if (!auth.config.authDisabled) {
        ensureSessionSecret(auth);
        const session = getSessionFromRequest(request, auth.sessionStore, auth.config.sessionSecret);
        if (session) {
          auth.sessionStore.deleteSession(session.id);
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
      const existingPassword = auth.passwordStore.findByEmail(email);
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
          roles: base.roles,
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
        const updated = { ...user, displayName: trimmedName, updatedAt: now() };
        await repo.saveUser(updated);
        user = updated;
      }

      const { hash, salt } = hashPassword(password);
      auth.passwordStore.save({
        userId: user.id,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now(),
        updatedAt: now()
      });

      const session = auth.sessionStore.createSession(user.id);
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

      const account = auth.passwordStore.findByEmail(email);
      if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
        reply.code(401).send({ error: "Invalid credentials" });
        return;
      }

      const user = await repo.findUser(account.userId);
      const session = auth.sessionStore.createSession(user.id);
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
