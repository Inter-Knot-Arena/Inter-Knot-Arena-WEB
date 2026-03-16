import type { Region } from "@ika/shared";

export interface VerifierSessionRecord {
  token: string;
  matchId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  usedNonces: string[];
}

export interface UidVerificationPendingRecord {
  userId: string;
  code: string;
  uid: string;
  region: Region;
  createdAt: number;
  expiresAt: number;
}

export interface UidVerificationAttemptRecord {
  userId: string;
  startedAt: number;
  count: number;
  expiresAt: number;
}

export interface VerificationStateStore {
  findVerifierSession(token: string): Promise<VerifierSessionRecord | null>;
  saveVerifierSession(session: VerifierSessionRecord): Promise<void>;
  deleteVerifierSession(token: string): Promise<void>;
  findUidVerificationPending(userId: string): Promise<UidVerificationPendingRecord | null>;
  saveUidVerificationPending(record: UidVerificationPendingRecord): Promise<void>;
  deleteUidVerificationPending(userId: string): Promise<void>;
  findUidVerificationAttempt(userId: string): Promise<UidVerificationAttemptRecord | null>;
  saveUidVerificationAttempt(record: UidVerificationAttemptRecord): Promise<void>;
  purgeExpired(referenceTimestamp?: number): Promise<void>;
}
