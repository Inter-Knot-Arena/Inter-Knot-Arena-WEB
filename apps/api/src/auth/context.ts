import type { FastifyRequest } from "fastify";
import type { User } from "@ika/shared";
import type { Repository } from "../repository/types.js";
import { now } from "../utils.js";
import { createGoogleAuthStateStore } from "./google.js";
import { createOAuthAccountStore } from "./oauth.js";
import { createSessionStore, getSessionFromRequest } from "./session.js";

export interface AuthConfig {
  webOrigin: string;
  apiOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  sessionSecret: string;
  sessionTtlMs: number;
  stateTtlMs: number;
  authDisabled: boolean;
}

export interface AuthContext {
  config: AuthConfig;
  sessionStore: ReturnType<typeof createSessionStore>;
  stateStore: ReturnType<typeof createGoogleAuthStateStore>;
  oauthStore: ReturnType<typeof createOAuthAccountStore>;
}

export function createAuthContext(): AuthContext {
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
  const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";
  const sessionTtlDays = Number(process.env.SESSION_TTL_DAYS ?? 7);
  const stateTtlSec = Number(process.env.AUTH_STATE_TTL_SEC ?? 600);

  return {
    config: {
      webOrigin,
      apiOrigin,
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? `${apiOrigin}/auth/google/callback`,
      sessionSecret: process.env.SESSION_SECRET ?? "",
      sessionTtlMs: sessionTtlDays * 24 * 60 * 60 * 1000,
      stateTtlMs: stateTtlSec * 1000,
      authDisabled: process.env.AUTH_DISABLED === "true"
    },
    sessionStore: createSessionStore(sessionTtlDays * 24 * 60 * 60 * 1000),
    stateStore: createGoogleAuthStateStore(stateTtlSec * 1000),
    oauthStore: createOAuthAccountStore()
  };
}

export async function getAuthUser(
  request: FastifyRequest,
  repo: Repository,
  auth: AuthContext
): Promise<User | null> {
  if (auth.config.authDisabled) {
    const users = await repo.listUsers();
    return users[0] ?? null;
  }
  if (!auth.config.sessionSecret) {
    return null;
  }
  const session = getSessionFromRequest(request, auth.sessionStore, auth.config.sessionSecret);
  if (!session) {
    return null;
  }
  try {
    return await repo.findUser(session.userId);
  } catch {
    auth.sessionStore.deleteSession(session.id);
    return null;
  }
}

export function ensureSessionSecret(auth: AuthContext): void {
  if (!auth.config.sessionSecret && !auth.config.authDisabled) {
    throw new Error("SESSION_SECRET is required for auth");
  }
}

export function resolveRedirect(target: string | undefined, webOrigin: string): string {
  if (!target) {
    return `${webOrigin}/profile`;
  }
  if (target.startsWith("/")) {
    return `${webOrigin}${target}`;
  }
  if (target.startsWith(webOrigin)) {
    return target;
  }
  return `${webOrigin}/profile`;
}

export function ensureAuthReady(auth: AuthContext): void {
  if (auth.config.authDisabled) {
    return;
  }
  if (!auth.config.googleClientId || !auth.config.googleClientSecret || !auth.config.googleRedirectUri) {
    throw new Error("Google OAuth env vars are required");
  }
  ensureSessionSecret(auth);
}

export function buildDefaultUser(): Omit<User, "id" | "email" | "displayName"> {
  return {
    avatarUrl: null,
    region: "OTHER",
    createdAt: now(),
    updatedAt: now(),
    roles: ["USER"],
    trustScore: 100,
    proxyLevel: { level: 1, xp: 0, nextXp: 100 },
    verification: { status: "UNVERIFIED" },
    privacy: { showUidPublicly: false, showMatchHistoryPublicly: true }
  };
}
