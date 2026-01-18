import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Session } from "@ika/shared";
import { createId, now } from "../utils.js";

export const SESSION_COOKIE_NAME = "ika_session";

export interface SessionStore {
  createSession(userId: string): Session;
  getSession(sessionId: string): Session | null;
  deleteSession(sessionId: string): void;
  purgeExpired(): void;
}

export interface SessionCookieOptions {
  secure: boolean;
  ttlMs: number;
  cookieName?: string;
}

export function createSessionStore(ttlMs = 1000 * 60 * 60 * 24 * 7): SessionStore {
  const sessions = new Map<string, Session>();

  return {
    createSession(userId: string) {
      const createdAt = now();
      const session: Session = {
        id: createId("sess"),
        userId,
        createdAt,
        expiresAt: createdAt + ttlMs
      };
      sessions.set(session.id, session);
      return session;
    },
    getSession(sessionId: string) {
      return sessions.get(sessionId) ?? null;
    },
    deleteSession(sessionId: string) {
      sessions.delete(sessionId);
    },
    purgeExpired() {
      const timestamp = now();
      for (const [id, session] of sessions.entries()) {
        if (session.expiresAt <= timestamp) {
          sessions.delete(id);
        }
      }
    }
  };
}

export function signSessionId(sessionId: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${signature}`;
}

export function verifySessionCookie(value: string, secret: string): string | null {
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) {
    return null;
  }
  const expected = createHmac("sha256", secret).update(sessionId).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }
  return sessionId;
}

export function getSessionFromRequest(
  request: FastifyRequest,
  store: SessionStore,
  secret: string,
  cookieName = SESSION_COOKIE_NAME
): Session | null {
  const raw = request.cookies?.[cookieName];
  if (!raw) {
    return null;
  }
  const sessionId = verifySessionCookie(raw, secret);
  if (!sessionId) {
    return null;
  }
  const session = store.getSession(sessionId);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= now()) {
    store.deleteSession(sessionId);
    return null;
  }
  return session;
}

export function setSessionCookie(
  reply: FastifyReply,
  sessionId: string,
  secret: string,
  options: SessionCookieOptions
): void {
  const cookieName = options.cookieName ?? SESSION_COOKIE_NAME;
  const signed = signSessionId(sessionId, secret);
  reply.setCookie(cookieName, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    path: "/",
    maxAge: Math.floor(options.ttlMs / 1000)
  });
}

export function clearSessionCookie(reply: FastifyReply, cookieName = SESSION_COOKIE_NAME): void {
  reply.clearCookie(cookieName, { path: "/" });
}

export function createCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}
