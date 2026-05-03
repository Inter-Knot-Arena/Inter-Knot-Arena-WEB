import type { PlayerAgentDynamic, PlayerRosterImportSummary, Region } from "@ika/shared";

export type UpsertMergeStrategy = "DEFAULT" | "ACCUMULATIVE" | "DIRECT";
export interface UpsertStateOptions {
  mergeStrategy?: UpsertMergeStrategy;
}

export interface PlayerAgentStateStore {
  listStates(uid: string, region: Region): Promise<PlayerAgentDynamic[]>;
  upsertStates(
    uid: string,
    region: Region,
    states: PlayerAgentDynamic[],
    options?: UpsertStateOptions
  ): Promise<void>;
  getImportSummary(uid: string, region: Region): Promise<PlayerRosterImportSummary | null>;
  saveImportSummary(uid: string, region: Region, summary: PlayerRosterImportSummary): Promise<void>;
  deletePlayerData(uid: string, region: Region): Promise<void>;
}
