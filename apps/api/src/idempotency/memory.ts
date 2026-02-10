import { now } from "../utils.js";
import type {
  IdempotencyReplay,
  IdempotencySaveInput,
  IdempotencyStore
} from "./types.js";

interface MemoryRecord extends IdempotencyReplay {
  expiresAt: number;
}

function compoundKey(key: string, scope: string, actorUserId: string): string {
  return `${scope}:${actorUserId}:${key}`;
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
  const records = new Map<string, MemoryRecord>();

  return {
    async find(key, scope, actorUserId) {
      const record = records.get(compoundKey(key, scope, actorUserId));
      if (!record) {
        return null;
      }
      if (record.expiresAt <= now()) {
        records.delete(compoundKey(key, scope, actorUserId));
        return null;
      }
      return {
        statusCode: record.statusCode,
        responseBody: record.responseBody
      };
    },
    async save(input: IdempotencySaveInput) {
      records.set(compoundKey(input.key, input.scope, input.actorUserId), {
        statusCode: input.statusCode,
        responseBody: input.responseBody,
        expiresAt: now() + input.ttlMs
      });
    },
    async purgeExpired(referenceTimestamp = now()) {
      for (const [key, value] of records.entries()) {
        if (value.expiresAt <= referenceTimestamp) {
          records.delete(key);
        }
      }
    }
  };
}
