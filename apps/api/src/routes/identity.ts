import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types.js";
import type { Region, User } from "@ika/shared";
import { getAuthUser, type AuthContext } from "../auth/context.js";
import { now, requireString } from "../utils.js";
import type { VerificationStateStore } from "../verificationState/types.js";

const REGIONS: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];
const pendingTtlMs = Number(process.env.UID_VERIFY_PENDING_TTL_MS ?? 30 * 60 * 1000);
const attemptWindowMs = Number(process.env.UID_VERIFY_RATE_WINDOW_MS ?? 10 * 60 * 1000);
const attemptMax = Number(process.env.UID_VERIFY_RATE_MAX_ATTEMPTS ?? 20);
const legacyUidVerificationEnabled = process.env.ENABLE_LEGACY_UID_VERIFY === "true";

function sendError(reply: { code: (status: number) => { send: (payload: unknown) => void } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.code(400).send({ error: message });
}

function isValidUid(value: string): boolean {
  return /^\d{6,12}$/.test(value);
}

function parseRegion(value: unknown): Region | null {
  if (typeof value !== "string") {
    return null;
  }
  return REGIONS.includes(value as Region) ? (value as Region) : null;
}

function isValidProofUrl(value: string): boolean {
  if (value.startsWith("data:image/")) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function assertAttemptRateLimit(
  userId: string,
  verificationState: VerificationStateStore
): Promise<void> {
  const timestamp = now();
  const row = await verificationState.findUidVerificationAttempt(userId);
  if (!row || row.expiresAt <= timestamp) {
    await verificationState.saveUidVerificationAttempt({
      userId,
      startedAt: timestamp,
      count: 1,
      expiresAt: timestamp + attemptWindowMs
    });
    return;
  }
  const nextCount = row.count + 1;
  await verificationState.saveUidVerificationAttempt({
    userId,
    startedAt: row.startedAt,
    count: nextCount,
    expiresAt: row.expiresAt
  });
  if (nextCount > attemptMax) {
    throw new Error("Too many UID verification attempts. Please retry later.");
  }
}

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  );
  return `IKA-${bytes.join("")}`;
}

export async function registerIdentityRoutes(
  app: FastifyInstance,
  repo: Repository,
  auth: AuthContext,
  verificationState: VerificationStateStore
) {
  app.post("/identity/uid/submit", async (request, reply) => {
    try {
      if (!legacyUidVerificationEnabled) {
        reply.code(410).send({
          error: "Legacy UID flow is deprecated. Use Verifier App OCR sync."
        });
        return;
      }
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      await assertAttemptRateLimit(user.id, verificationState);
      await verificationState.purgeExpired();

      const body = request.body as { uid?: string; region?: string };
      const uid = requireString(body?.uid, "uid");
      const region = parseRegion(body?.region);
      if (!isValidUid(uid)) {
        throw new Error("UID must be 6-12 digits");
      }
      if (!region) {
        throw new Error("Invalid region");
      }

      const code = generateCode();
      const createdAt = now();
      await verificationState.saveUidVerificationPending({
        userId: user.id,
        code,
        uid,
        region,
        createdAt,
        expiresAt: createdAt + pendingTtlMs
      });

      const updated: User = {
        ...user,
        roles: user.roles.filter((role) => role !== "VERIFIED"),
        verification: { status: "PENDING", uid, region },
        updatedAt: now()
      };
      await repo.saveUser(updated);

      reply.send({ code, status: "PENDING" });
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/identity/uid/verify-proof", async (request, reply) => {
    try {
      if (!legacyUidVerificationEnabled) {
        reply.code(410).send({
          error: "Legacy UID proof flow is deprecated. Use Verifier App OCR sync."
        });
        return;
      }
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
      await assertAttemptRateLimit(user.id, verificationState);
      await verificationState.purgeExpired();

      const body = request.body as { uid?: string; region?: string; code?: string; proofUrl?: string };
      const uid = requireString(body?.uid, "uid");
      const code = requireString(body?.code, "code");
      const proofUrl = requireString(body?.proofUrl, "proofUrl");
      const region = parseRegion(body?.region);
      if (!isValidUid(uid)) {
        throw new Error("UID must be 6-12 digits");
      }
      if (!region) {
        throw new Error("Invalid region");
      }
      if (!isValidProofUrl(proofUrl)) {
        throw new Error("proofUrl must be a valid URL");
      }

      const pending = await verificationState.findUidVerificationPending(user.id);
      if (!pending) {
        throw new Error("No pending UID verification found");
      }
      if (pending.expiresAt <= now()) {
        await verificationState.deleteUidVerificationPending(user.id);
        throw new Error("UID verification request expired. Submit again.");
      }
      if (pending.code !== code) {
        throw new Error("Invalid verification code");
      }
      if (pending.uid !== uid || pending.region !== region) {
        throw new Error("UID or region mismatch");
      }

      const updated: User = {
        ...user,
        roles: user.roles.includes("VERIFIED") ? user.roles : [...user.roles, "VERIFIED"],
        verification: { status: "VERIFIED", uid, region },
        updatedAt: now()
      };
      await repo.saveUser(updated);
      await verificationState.deleteUidVerificationPending(user.id);

      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });
}
