import type { Pool } from "pg";
import { getPool } from "../db/pool.js";
import { now } from "../utils.js";
import type {
  IdempotencyReplay,
  IdempotencySaveInput,
  IdempotencyStore
} from "./types.js";

export function createPostgresIdempotencyStore(pool: Pool = getPool()): IdempotencyStore {
  return {
    async find(key, scope, actorUserId) {
      const result = await pool.query(
        `SELECT status_code, response_body, expires_at
         FROM idempotency_records
         WHERE idempotency_key = $1
           AND scope = $2
           AND actor_user_id = $3`,
        [key, scope, actorUserId]
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      if (toNumber(row.expires_at) <= now()) {
        await pool.query(
          `DELETE FROM idempotency_records
           WHERE idempotency_key = $1
             AND scope = $2
             AND actor_user_id = $3`,
          [key, scope, actorUserId]
        );
        return null;
      }
      const payload: IdempotencyReplay = {
        statusCode: Number(row.status_code),
        responseBody: row.response_body
      };
      return payload;
    },
    async save(input: IdempotencySaveInput) {
      const timestamp = now();
      await pool.query(
        `INSERT INTO idempotency_records (
           idempotency_key,
           scope,
           actor_user_id,
           status_code,
           response_body,
           created_at,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (idempotency_key, scope, actor_user_id) DO UPDATE
         SET status_code = EXCLUDED.status_code,
             response_body = EXCLUDED.response_body,
             created_at = EXCLUDED.created_at,
             expires_at = EXCLUDED.expires_at`,
        [
          input.key,
          input.scope,
          input.actorUserId,
          input.statusCode,
          JSON.stringify(input.responseBody ?? null),
          timestamp,
          timestamp + input.ttlMs
        ]
      );
    },
    async purgeExpired(referenceTimestamp = now()) {
      await pool.query(
        `DELETE FROM idempotency_records
         WHERE expires_at <= $1`,
        [referenceTimestamp]
      );
    }
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}
