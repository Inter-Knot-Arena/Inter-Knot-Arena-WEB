import type { CacheClient } from "./types.js";
import { createMemoryCache } from "./memory.js";

export interface CacheConfig {
  ttlMs: number;
}

export function createCache(): { client: CacheClient; config: CacheConfig } {
  const ttlMs = Number(process.env.CACHE_TTL_MS ?? 600000);
  return {
    client: createMemoryCache(),
    config: { ttlMs: Number.isFinite(ttlMs) ? ttlMs : 600000 }
  };
}
