import type { VerificationStateStore } from "./types.js";
import { createMemoryVerificationStateStore } from "./memory.js";
import { createPostgresVerificationStateStore } from "./postgres.js";

export function createVerificationStateStore(): VerificationStateStore {
  const driver =
    process.env.IKA_VERIFICATION_STATE_DRIVER ?? (process.env.DATABASE_URL ? "postgres" : "memory");
  if (driver === "postgres") {
    return createPostgresVerificationStateStore();
  }
  if (driver === "memory") {
    return createMemoryVerificationStateStore();
  }
  throw new Error(`Unknown verification state driver: ${driver}`);
}
