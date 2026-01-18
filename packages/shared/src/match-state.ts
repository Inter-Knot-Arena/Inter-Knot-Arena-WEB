import type { MatchState } from "./types.js";

export const matchStateTransitions: Record<MatchState, MatchState[]> = {
  CREATED: ["CHECKIN", "CANCELED"],
  CHECKIN: ["DRAFTING", "CANCELED", "EXPIRED"],
  DRAFTING: ["AWAITING_PRECHECK", "CANCELED", "EXPIRED"],
  AWAITING_PRECHECK: ["READY_TO_START", "DISPUTED", "CANCELED"],
  READY_TO_START: ["IN_PROGRESS", "DISPUTED", "CANCELED"],
  IN_PROGRESS: ["AWAITING_RESULT_UPLOAD", "DISPUTED", "CANCELED"],
  AWAITING_RESULT_UPLOAD: ["AWAITING_CONFIRMATION", "DISPUTED", "CANCELED"],
  AWAITING_CONFIRMATION: ["RESOLVED", "DISPUTED", "CANCELED"],
  DISPUTED: ["RESOLVED", "CANCELED"],
  RESOLVED: [],
  CANCELED: [],
  EXPIRED: []
};

export function canTransition(from: MatchState, to: MatchState): boolean {
  return matchStateTransitions[from]?.includes(to) ?? false;
}
