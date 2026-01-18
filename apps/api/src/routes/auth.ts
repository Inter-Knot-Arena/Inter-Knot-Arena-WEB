import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types";
import { createId, now, requireString } from "../utils";
import {
  buildDefaultUser,
  ensureAuthReady,
  ensureSessionSecret,
  getAuthUser,
  resolveRedirect,
  type AuthContext
} from "../auth/context";
import {
  buildGoogleAuthUrl,
  createCodeChallenge,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  parseIdTokenPayload
} from "../auth/google";
import {
  SESSION_COOKIE_NAME,
  createCodeVerifier,
  getSessionFromRequest,
  setSessionCookie
} from "../auth/session";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  repo: Repository,
  auth: AuthContext
) {
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
        nonce
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

      if (!user) {
        const base = buildDefaultUser();
        user = {
          id: createId("user"),
          email: profile.email,
          displayName: profile.name || profile.email.split("@")[0],
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
        await repo.createUser(user);
      } else {
        user = {
          ...user,
          email: profile.email,
          displayName: profile.name || user.displayName,
          avatarUrl: profile.picture ?? user.avatarUrl,
          updatedAt: now()
        };
        await repo.saveUser(user);
      }

      auth.oauthStore.save({
        provider: "google",
        providerAccountId: profile.sub,
        userId: user.id,
        email: profile.email,
        createdAt: now(),
        updatedAt: now()
      });

      const session = auth.sessionStore.createSession(user.id);
      setSessionCookie(reply, session.id, auth.config.sessionSecret, {
        secure: process.env.NODE_ENV === "production",
        ttlMs: auth.config.sessionTtlMs
      });

      reply.redirect(stored.redirectTo || `${auth.config.webOrigin}/profile/${user.id}`);
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
      reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      reply.send({ status: "ok" });
    } catch (error) {
      sendError(reply, error);
    }
  });
}
