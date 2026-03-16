import type { Pool } from "pg";
import { getPool } from "../db/pool.js";
import { now } from "../utils.js";
import type {
  UidVerificationAttemptRecord,
  UidVerificationPendingRecord,
  VerificationStateStore,
  VerifierSessionRecord
} from "./types.js";

export function createPostgresVerificationStateStore(pool: Pool = getPool()): VerificationStateStore {
  return {
    async findVerifierSession(token) {
      const result = await pool.query(
        `SELECT *
         FROM verifier_sessions
         WHERE token = $1`,
        [token]
      );
      const row = result.rows[0];
      return row ? mapVerifierSession(row) : null;
    },
    async saveVerifierSession(session) {
      await pool.query(
        `INSERT INTO verifier_sessions (
           token,
           match_id,
           user_id,
           created_at,
           expires_at,
           used_nonces
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (token) DO UPDATE
         SET match_id = EXCLUDED.match_id,
             user_id = EXCLUDED.user_id,
             created_at = EXCLUDED.created_at,
             expires_at = EXCLUDED.expires_at,
             used_nonces = EXCLUDED.used_nonces`,
        [
          session.token,
          session.matchId,
          session.userId,
          session.createdAt,
          session.expiresAt,
          JSON.stringify(session.usedNonces)
        ]
      );
    },
    async deleteVerifierSession(token) {
      await pool.query(`DELETE FROM verifier_sessions WHERE token = $1`, [token]);
    },
    async findUidVerificationPending(userId) {
      const result = await pool.query(
        `SELECT *
         FROM uid_verification_pending
         WHERE user_id = $1`,
        [userId]
      );
      const row = result.rows[0];
      return row ? mapUidVerificationPending(row) : null;
    },
    async saveUidVerificationPending(record) {
      await pool.query(
        `INSERT INTO uid_verification_pending (
           user_id,
           code,
           uid,
           region,
           created_at,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE
         SET code = EXCLUDED.code,
             uid = EXCLUDED.uid,
             region = EXCLUDED.region,
             created_at = EXCLUDED.created_at,
             expires_at = EXCLUDED.expires_at`,
        [
          record.userId,
          record.code,
          record.uid,
          record.region,
          record.createdAt,
          record.expiresAt
        ]
      );
    },
    async deleteUidVerificationPending(userId) {
      await pool.query(`DELETE FROM uid_verification_pending WHERE user_id = $1`, [userId]);
    },
    async findUidVerificationAttempt(userId) {
      const result = await pool.query(
        `SELECT *
         FROM uid_verification_attempts
         WHERE user_id = $1`,
        [userId]
      );
      const row = result.rows[0];
      return row ? mapUidVerificationAttempt(row) : null;
    },
    async saveUidVerificationAttempt(record) {
      await pool.query(
        `INSERT INTO uid_verification_attempts (
           user_id,
           started_at,
           count,
           expires_at
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
         SET started_at = EXCLUDED.started_at,
             count = EXCLUDED.count,
             expires_at = EXCLUDED.expires_at`,
        [record.userId, record.startedAt, record.count, record.expiresAt]
      );
    },
    async purgeExpired(referenceTimestamp = now()) {
      await Promise.all([
        pool.query(`DELETE FROM verifier_sessions WHERE expires_at <= $1`, [referenceTimestamp]),
        pool.query(`DELETE FROM uid_verification_pending WHERE expires_at <= $1`, [referenceTimestamp]),
        pool.query(`DELETE FROM uid_verification_attempts WHERE expires_at <= $1`, [referenceTimestamp])
      ]);
    }
  };
}

function mapVerifierSession(row: Record<string, unknown>): VerifierSessionRecord {
  return {
    token: String(row.token),
    matchId: String(row.match_id),
    userId: String(row.user_id),
    createdAt: toNumber(row.created_at),
    expiresAt: toNumber(row.expires_at),
    usedNonces: Array.isArray(row.used_nonces)
      ? row.used_nonces.map((value) => String(value))
      : []
  };
}

function mapUidVerificationPending(row: Record<string, unknown>): UidVerificationPendingRecord {
  return {
    userId: String(row.user_id),
    code: String(row.code),
    uid: String(row.uid),
    region: String(row.region) as UidVerificationPendingRecord["region"],
    createdAt: toNumber(row.created_at),
    expiresAt: toNumber(row.expires_at)
  };
}

function mapUidVerificationAttempt(row: Record<string, unknown>): UidVerificationAttemptRecord {
  return {
    userId: String(row.user_id),
    startedAt: toNumber(row.started_at),
    count: Number(row.count),
    expiresAt: toNumber(row.expires_at)
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
