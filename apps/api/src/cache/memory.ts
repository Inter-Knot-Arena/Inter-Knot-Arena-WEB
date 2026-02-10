import type { CacheClient } from "./types.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function createMemoryCache(): CacheClient {
  const store = new Map<string, CacheEntry<unknown>>();

  return {
    get<T>(key: string): T | null {
      const entry = store.get(key);
      if (!entry) {
        return null;
      }
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    set<T>(key: string, value: T, ttlMs: number) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
  };
}
