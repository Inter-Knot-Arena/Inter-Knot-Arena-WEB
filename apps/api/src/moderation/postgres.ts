import type { RankBand, Sanction } from "@ika/shared";
import type { Pool } from "pg";
import { getPool } from "../db/pool.js";
import type { ModerationStore } from "./types.js";

export function createPostgresModerationStore(pool: Pool = getPool()): ModerationStore {
  return {
    async listSanctions(limit = 100) {
      const result = await pool.query(
        `SELECT *
         FROM sanctions
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows.map(mapSanction);
    },
    async listActiveSanctionsByUser(userId) {
      const nowTs = Date.now();
      const result = await pool.query(
        `SELECT *
         FROM sanctions
         WHERE user_id = $1
           AND status = 'ACTIVE'
           AND (expires_at IS NULL OR expires_at > $2)
         ORDER BY created_at DESC`,
        [userId, nowTs]
      );

      await pool.query(
        `UPDATE sanctions
         SET status = 'EXPIRED'
         WHERE user_id = $1
           AND status = 'ACTIVE'
           AND expires_at IS NOT NULL
           AND expires_at <= $2`,
        [userId, nowTs]
      );

      return result.rows.map(mapSanction);
    },
    async saveSanction(sanction) {
      await pool.query(
        `INSERT INTO sanctions (
           id,
           user_id,
           type,
           status,
           reason,
           issued_by,
           match_id,
           metadata,
           created_at,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             type = EXCLUDED.type,
             status = EXCLUDED.status,
             reason = EXCLUDED.reason,
             issued_by = EXCLUDED.issued_by,
             match_id = EXCLUDED.match_id,
             metadata = EXCLUDED.metadata,
             created_at = EXCLUDED.created_at,
             expires_at = EXCLUDED.expires_at`,
        [
          sanction.id,
          sanction.userId,
          sanction.type,
          sanction.status,
          sanction.reason,
          sanction.issuedBy ?? null,
          sanction.matchId ?? null,
          sanction.metadata ? JSON.stringify(sanction.metadata) : null,
          sanction.createdAt,
          sanction.expiresAt ?? null
        ]
      );
      return sanction;
    },
    async listRankBands() {
      const result = await pool.query(
        `SELECT *
         FROM rank_bands
         ORDER BY sort_order ASC`
      );
      return result.rows.map(mapRankBand);
    },
    async saveRankBands(rankBands) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM rank_bands");
        for (const band of rankBands) {
          await client.query(
            `INSERT INTO rank_bands (
               id,
               name,
               min_elo,
               max_elo,
               badge,
               sort_order
             )
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              band.id,
              band.name,
              band.minElo,
              band.maxElo ?? null,
              band.badge ?? null,
              band.sortOrder
            ]
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return rankBands.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    }
  };
}

function mapSanction(row: Record<string, unknown>): Sanction {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type) as Sanction["type"],
    status: String(row.status) as Sanction["status"],
    reason: String(row.reason),
    issuedBy: (row.issued_by as string | null) ?? undefined,
    matchId: (row.match_id as string | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: toNumber(row.created_at),
    expiresAt: row.expires_at ? toNumber(row.expires_at) : undefined
  };
}

function mapRankBand(row: Record<string, unknown>): RankBand {
  return {
    id: String(row.id),
    name: String(row.name),
    minElo: Number(row.min_elo),
    maxElo: row.max_elo === null ? undefined : Number(row.max_elo),
    badge: (row.badge as string | null) ?? undefined,
    sortOrder: Number(row.sort_order)
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
