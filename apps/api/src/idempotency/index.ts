import type { IdempotencyStore } from "./types.js";
import { createMemoryIdempotencyStore } from "./memory.js";
import { createPostgresIdempotencyStore } from "./postgres.js";

export function createIdempotencyStore(): IdempotencyStore {
  const driver =
    process.env.IKA_IDEMPOTENCY_DRIVER ?? (process.env.DATABASE_URL ? "postgres" : "memory");
  if (driver === "postgres") {
    return createPostgresIdempotencyStore();
  }
  if (driver === "memory") {
    return createMemoryIdempotencyStore();
  }
  throw new Error(`Unknown idempotency driver: ${driver}`);
}
