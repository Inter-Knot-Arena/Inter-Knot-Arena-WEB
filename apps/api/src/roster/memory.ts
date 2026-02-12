import type { PlayerAgentDynamic, PlayerRosterImportSummary, Region } from "@ika/shared";
import { mergePlayerAgentDynamic, mergePlayerAgentDynamicAccumulative } from "@ika/shared";
import type { PlayerAgentStateStore, PlayerImportSnapshot, UpsertStateOptions } from "./types.js";

function key(uid: string, region: Region): string {
  return `${region}:${uid}`;
}

export function createMemoryRosterStore(): PlayerAgentStateStore {
  const states = new Map<string, Map<string, PlayerAgentDynamic>>();
  const summaries = new Map<string, PlayerRosterImportSummary>();
  const snapshots = new Map<string, PlayerImportSnapshot[]>();

  return {
    async listStates(uid, region) {
      return Array.from(states.get(key(uid, region))?.values() ?? []);
    },
    async upsertStates(uid, region, incomingStates, options: UpsertStateOptions = {}) {
      const storeKey = key(uid, region);
      const current = states.get(storeKey) ?? new Map<string, PlayerAgentDynamic>();
      for (const incoming of incomingStates) {
        const existing = current.get(incoming.agentId);
        if (options.mergeStrategy === "DIRECT") {
          current.set(incoming.agentId, incoming);
        } else if (options.mergeStrategy === "ACCUMULATIVE") {
          current.set(incoming.agentId, mergePlayerAgentDynamicAccumulative(existing, incoming));
        } else {
          current.set(incoming.agentId, mergePlayerAgentDynamic(existing, incoming));
        }
      }
      states.set(storeKey, current);
    },
    async getImportSummary(uid, region) {
      return summaries.get(key(uid, region)) ?? null;
    },
    async saveImportSummary(uid, region, summary) {
      summaries.set(key(uid, region), summary);
    },
    async saveSnapshot(snapshot) {
      const storeKey = key(snapshot.uid, snapshot.region);
      const current = snapshots.get(storeKey) ?? [];
      current.push(snapshot);
      snapshots.set(storeKey, current);
    },
    async getLatestSnapshot(uid, region) {
      const storeKey = key(uid, region);
      const current = snapshots.get(storeKey) ?? [];
      const timestamp = Date.now();
      const valid = current
        .filter((snapshot) => {
          const fetchedAtMs = new Date(snapshot.fetchedAt).getTime();
          if (!Number.isFinite(fetchedAtMs)) {
            return false;
          }
          return fetchedAtMs + snapshot.ttlSeconds * 1000 > timestamp;
        })
        .sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
      return valid[0] ?? null;
    },
    async cleanupExpiredSnapshots(nowTimestamp = Date.now()) {
      let removed = 0;
      for (const [storeKey, current] of snapshots.entries()) {
        const filtered = current.filter((snapshot) => {
          const fetchedAtMs = new Date(snapshot.fetchedAt).getTime();
          const expired = !Number.isFinite(fetchedAtMs) || fetchedAtMs + snapshot.ttlSeconds * 1000 <= nowTimestamp;
          if (expired) {
            removed += 1;
          }
          return !expired;
        });
        snapshots.set(storeKey, filtered);
      }
      return removed;
    }
  };
}
