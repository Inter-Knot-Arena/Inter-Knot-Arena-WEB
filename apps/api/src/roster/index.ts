import type { PlayerAgentStateStore } from "./types.js";
import { createMemoryRosterStore } from "./memory.js";
import { createPostgresRosterStore } from "./postgres.js";

export async function createRosterStore(): Promise<PlayerAgentStateStore> {
  if (process.env.DATABASE_URL) {
    return createPostgresRosterStore();
  }
  return createMemoryRosterStore();
}
