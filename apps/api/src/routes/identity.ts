import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository/types.js";
import type { Region, User } from "@ika/shared";
import { getAuthUser, type AuthContext } from "../auth/context.js";
import { now, requireString } from "../utils.js";

const REGIONS: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];
const pendingMap = new Map<
  string,
  { code: string; uid: string; region: Region; createdAt: number }
>();

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
  auth: AuthContext
) {
  app.post("/identity/uid/submit", async (request, reply) => {
    try {
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }

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
      pendingMap.set(user.id, { code, uid, region, createdAt: now() });

      const updated: User = {
        ...user,
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
      const user = await getAuthUser(request, repo, auth);
      if (!user) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }

      const body = request.body as { uid?: string; region?: string; code?: string; proofUrl?: string };
      const uid = requireString(body?.uid, "uid");
      const code = requireString(body?.code, "code");
      const region = parseRegion(body?.region);
      if (!isValidUid(uid)) {
        throw new Error("UID must be 6-12 digits");
      }
      if (!region) {
        throw new Error("Invalid region");
      }

      const pending = pendingMap.get(user.id);
      if (!pending) {
        throw new Error("No pending UID verification found");
      }
      if (pending.code !== code) {
        throw new Error("Invalid verification code");
      }
      if (pending.uid !== uid || pending.region !== region) {
        throw new Error("UID or region mismatch");
      }

      const updated: User = {
        ...user,
        verification: { status: "VERIFIED", uid, region },
        updatedAt: now()
      };
      await repo.saveUser(updated);
      pendingMap.delete(user.id);

      reply.send(updated);
    } catch (error) {
      sendError(reply, error);
    }
  });
}
