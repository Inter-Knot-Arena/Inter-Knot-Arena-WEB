import type { PlayerAgentDynamic, PlayerRosterImportSummary, Region } from "@ika/shared";

export interface PlayerAgentStateStore {
  listStates(uid: string, region: Region): Promise<PlayerAgentDynamic[]>;
  upsertStates(uid: string, region: Region, states: PlayerAgentDynamic[]): Promise<void>;
  getImportSummary(uid: string, region: Region): Promise<PlayerRosterImportSummary | null>;
  saveImportSummary(uid: string, region: Region, summary: PlayerRosterImportSummary): Promise<void>;
}
