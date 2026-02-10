import type { RankBand, Sanction } from "@ika/shared";

export interface ModerationStore {
  listSanctions(limit?: number): Promise<Sanction[]>;
  saveSanction(sanction: Sanction): Promise<Sanction>;
  listRankBands(): Promise<RankBand[]>;
  saveRankBands(rankBands: RankBand[]): Promise<RankBand[]>;
}
