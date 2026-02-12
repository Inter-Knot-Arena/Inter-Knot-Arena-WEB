import type { PlayerAgentDynamic, PlayerRosterImportSummary, Region } from "@ika/shared";
import { mergePlayerAgentDynamic, mergePlayerAgentDynamicAccumulative } from "@ika/shared";
import { getPool } from "../db/pool.js";
import type { PlayerAgentStateStore, PlayerImportSnapshot, UpsertStateOptions } from "./types.js";

export function createPostgresRosterStore(): PlayerAgentStateStore {
  const pool = getPool();

  const listStates = async (uid: string, region: Region) => {
    const result = await pool.query(
      `SELECT state
       FROM player_agent_states
       WHERE uid = $1 AND region = $2`,
      [uid, region]
    );
    return result.rows.map((row) => row.state as PlayerAgentDynamic);
  };

  return {
    listStates,
    async upsertStates(uid, region, incomingStates, options: UpsertStateOptions = {}) {
      let merged = incomingStates;
      if (options.mergeStrategy !== "DIRECT") {
        const existing = await listStates(uid, region);
        const existingMap = new Map(existing.map((state) => [state.agentId, state]));
        merged = incomingStates.map((incoming) => {
          const current = existingMap.get(incoming.agentId);
          if (options.mergeStrategy === "ACCUMULATIVE") {
            return mergePlayerAgentDynamicAccumulative(current, incoming);
          }
          return mergePlayerAgentDynamic(current, incoming);
        });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const state of merged) {
          await client.query(
            `INSERT INTO player_agent_states (uid, region, agent_id, state, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (uid, region, agent_id)
             DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
            [uid, region, state.agentId, JSON.stringify(state), Date.now()]
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async getImportSummary(uid, region) {
      const result = await pool.query(
        `SELECT summary
         FROM roster_imports
         WHERE uid = $1 AND region = $2`,
        [uid, region]
      );
      return result.rows[0]?.summary ?? null;
    },
    async saveImportSummary(uid, region, summary) {
      await pool.query(
        `INSERT INTO roster_imports (uid, region, summary, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (uid, region)
         DO UPDATE SET summary = EXCLUDED.summary, updated_at = EXCLUDED.updated_at`,
        [uid, region, JSON.stringify(summary), Date.now()]
      );
    },
    async saveSnapshot(snapshot: PlayerImportSnapshot) {
      await pool.query(
        `INSERT INTO player_import_snapshots
          (snapshot_id, uid, region, fetched_at, showcase_agent_ids, raw_enka, ttl_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          snapshot.snapshotId,
          snapshot.uid,
          snapshot.region,
          new Date(snapshot.fetchedAt).getTime(),
          JSON.stringify(snapshot.showcaseAgentIds),
          snapshot.rawEnkaJson ? JSON.stringify(snapshot.rawEnkaJson) : null,
          snapshot.ttlSeconds
        ]
      );
    },
    async getLatestSnapshot(uid, region) {
      const nowTs = Date.now();
      const result = await pool.query(
        `SELECT *
         FROM player_import_snapshots
         WHERE uid = $1
           AND region = $2
           AND fetched_at + (ttl_seconds * 1000) > $3
         ORDER BY fetched_at DESC
         LIMIT 1`,
        [uid, region, nowTs]
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return {
        snapshotId: String(row.snapshot_id),
        uid: String(row.uid),
        region: row.region as Region,
        fetchedAt: new Date(Number(row.fetched_at)).toISOString(),
        showcaseAgentIds: (row.showcase_agent_ids as string[]) ?? [],
        rawEnkaJson: row.raw_enka ?? undefined,
        ttlSeconds: Number(row.ttl_seconds)
      };
    },
    async cleanupExpiredSnapshots(nowTimestamp = Date.now()) {
      const result = await pool.query(
        `DELETE FROM player_import_snapshots
         WHERE fetched_at + (ttl_seconds * 1000) <= $1`,
        [nowTimestamp]
      );
      return Number(result.rowCount ?? 0);
    }
  };
}
