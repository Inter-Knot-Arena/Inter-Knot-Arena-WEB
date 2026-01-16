import type { Repository } from "./types";
import { createMemoryRepository } from "./memory";
import { createPostgresRepository } from "./postgres";

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
