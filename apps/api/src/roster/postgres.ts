import type { PlayerAgentDynamic, PlayerRosterImportSummary, Region } from "@ika/shared";
import { mergePlayerAgentDynamic } from "@ika/shared";
import { getPool } from "../db/pool.js";
import type { PlayerAgentStateStore } from "./types.js";

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
    async upsertStates(uid, region, incomingStates) {
      const existing = await listStates(uid, region);
      const existingMap = new Map(existing.map((state) => [state.agentId, state]));
      const merged = incomingStates.map((incoming) =>
        mergePlayerAgentDynamic(existingMap.get(incoming.agentId), incoming)
      );

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
    }
  };
}
