import type { RankBand, Sanction } from "@ika/shared";
import type { ModerationStore } from "./types.js";

const DEFAULT_RANK_BANDS: RankBand[] = [
  { id: "proxy_rookie", name: "Proxy Rookie", minElo: 0, maxElo: 999, sortOrder: 1 },
  { id: "inter_knot_runner", name: "Inter-Knot Runner", minElo: 1000, maxElo: 1199, sortOrder: 2 },
  { id: "hollow_scout", name: "Hollow Scout", minElo: 1200, maxElo: 1399, sortOrder: 3 },
  { id: "field_agent", name: "Field Agent", minElo: 1400, maxElo: 1599, sortOrder: 4 },
  { id: "elite_operative", name: "Elite Operative", minElo: 1600, maxElo: 1799, sortOrder: 5 },
  { id: "section_captain", name: "Section Captain", minElo: 1800, maxElo: 1999, sortOrder: 6 },
  { id: "new_eridu_legend", name: "New Eridu Legend", minElo: 2000, sortOrder: 7 }
];

export function createMemoryModerationStore(): ModerationStore {
  const sanctions = new Map<string, Sanction>();
  let rankBands: RankBand[] = DEFAULT_RANK_BANDS.slice();

  return {
    async listSanctions(limit = 100) {
      return Array.from(sanctions.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },
    async listActiveSanctionsByUser(userId) {
      const timestamp = Date.now();
      return Array.from(sanctions.values())
        .filter((sanction) => {
          if (sanction.userId !== userId) {
            return false;
          }
          if (sanction.status !== "ACTIVE") {
            return false;
          }
          if (sanction.expiresAt && sanction.expiresAt <= timestamp) {
            sanction.status = "EXPIRED";
            sanctions.set(sanction.id, sanction);
            return false;
          }
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async saveSanction(sanction) {
      sanctions.set(sanction.id, sanction);
      return sanction;
    },
    async listRankBands() {
      return rankBands.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async saveRankBands(input) {
      rankBands = input
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((band) => ({ ...band }));
      return rankBands;
    }
  };
}
