import { now } from "../utils.js";
import type {
  UidVerificationAttemptRecord,
  UidVerificationPendingRecord,
  VerificationStateStore,
  VerifierSessionRecord
} from "./types.js";

export function createMemoryVerificationStateStore(): VerificationStateStore {
  const verifierSessions = new Map<string, VerifierSessionRecord>();
  const uidPending = new Map<string, UidVerificationPendingRecord>();
  const uidAttempts = new Map<string, UidVerificationAttemptRecord>();

  return {
    async findVerifierSession(token) {
      return verifierSessions.get(token) ?? null;
    },
    async saveVerifierSession(session) {
      verifierSessions.set(session.token, {
        ...session,
        usedNonces: session.usedNonces.slice()
      });
    },
    async deleteVerifierSession(token) {
      verifierSessions.delete(token);
    },
    async findUidVerificationPending(userId) {
      return uidPending.get(userId) ?? null;
    },
    async saveUidVerificationPending(record) {
      uidPending.set(record.userId, { ...record });
    },
    async deleteUidVerificationPending(userId) {
      uidPending.delete(userId);
    },
    async findUidVerificationAttempt(userId) {
      return uidAttempts.get(userId) ?? null;
    },
    async saveUidVerificationAttempt(record) {
      uidAttempts.set(record.userId, { ...record });
    },
    async purgeExpired(referenceTimestamp = now()) {
      for (const [token, session] of verifierSessions.entries()) {
        if (session.expiresAt <= referenceTimestamp) {
          verifierSessions.delete(token);
        }
      }
      for (const [userId, pending] of uidPending.entries()) {
        if (pending.expiresAt <= referenceTimestamp) {
          uidPending.delete(userId);
        }
      }
      for (const [userId, attempt] of uidAttempts.entries()) {
        if (attempt.expiresAt <= referenceTimestamp) {
          uidAttempts.delete(userId);
        }
      }
    }
  };
}
