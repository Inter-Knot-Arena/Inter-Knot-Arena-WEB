import type { AuditStore } from "./types.js";
import { createMemoryAuditStore } from "./memory.js";
import { createPostgresAuditStore } from "./postgres.js";

export function createAuditStore(): AuditStore {
  const driver = process.env.IKA_AUDIT_DRIVER ?? (process.env.DATABASE_URL ? "postgres" : "memory");
  if (driver === "postgres") {
    return createPostgresAuditStore();
  }
  if (driver === "memory") {
    return createMemoryAuditStore();
  }
  throw new Error(`Unknown audit driver: ${driver}`);
}
