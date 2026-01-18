import type { Repository } from "./types.js";
import { createMemoryRepository } from "./memory.js";
import { createPostgresRepository } from "./postgres.js";

export async function createRepository(): Promise<Repository> {
  const driver = process.env.IKA_REPOSITORY ?? (process.env.DATABASE_URL ? "postgres" : "memory");
  if (driver === "postgres") {
    return createPostgresRepository();
  }
  if (driver === "memory") {
    return createMemoryRepository();
  }
  throw new Error(`Unknown repository driver: ${driver}`);
}
