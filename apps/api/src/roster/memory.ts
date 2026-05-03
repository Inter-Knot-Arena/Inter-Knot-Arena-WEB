import type { PlayerAgentDynamic, PlayerRosterImportSummary, Region } from "@ika/shared";
import { mergePlayerAgentDynamic, mergePlayerAgentDynamicAccumulative } from "@ika/shared";
import type { PlayerAgentStateStore, UpsertStateOptions } from "./types.js";

function key(uid: string, region: Region): string {
  return `${region}:${uid}`;
}

export function createMemoryRosterStore(): PlayerAgentStateStore {
  const states = new Map<string, Map<string, PlayerAgentDynamic>>();
  const summaries = new Map<string, PlayerRosterImportSummary>();

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
    async deletePlayerData(uid, region) {
      const storeKey = key(uid, region);
      states.delete(storeKey);
      summaries.delete(storeKey);
    }
  };
}
