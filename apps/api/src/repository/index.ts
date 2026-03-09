import type { Repository } from "./types.js";
import { createMemoryRepository } from "./memory.js";
import { createPostgresRepository } from "./postgres.js";

export async function createRepository(): Promise<Repository> {
  const driver = process.env.IKA_REPOSITORY ?? (process.env.DATABASE_URL ? "postgres" : null);
  if (driver === "postgres") {
    return createPostgresRepository();
  }
  if (driver === "memory") {
    return createMemoryRepository();
  }
  if (!driver) {
    throw new Error(
      "Repository configuration missing. Set DATABASE_URL for postgres or IKA_REPOSITORY=memory for ephemeral mode."
    );
  }
  throw new Error(`Unknown repository driver: ${driver}`);
}
