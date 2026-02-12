import type { PlayerAgentDynamic, PlayerRosterImportSummary, Region } from "@ika/shared";

export interface PlayerImportSnapshot {
  snapshotId: string;
  uid: string;
  region: Region;
  fetchedAt: string;
  showcaseAgentIds: string[];
  rawEnkaJson?: unknown;
  ttlSeconds: number;
}

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
  saveSnapshot(snapshot: PlayerImportSnapshot): Promise<void>;
  getLatestSnapshot(uid: string, region: Region): Promise<PlayerImportSnapshot | null>;
  cleanupExpiredSnapshots(nowTimestamp?: number): Promise<number>;
}
