import type { ModerationStore } from "./types.js";
import { createMemoryModerationStore } from "./memory.js";
import { createPostgresModerationStore } from "./postgres.js";

export function createModerationStore(): ModerationStore {
  const driver =
    process.env.IKA_MODERATION_DRIVER ?? (process.env.DATABASE_URL ? "postgres" : "memory");
  if (driver === "postgres") {
    return createPostgresModerationStore();
  }
  if (driver === "memory") {
    return createMemoryModerationStore();
  }
  throw new Error(`Unknown moderation driver: ${driver}`);
}
