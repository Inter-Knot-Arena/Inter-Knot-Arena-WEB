export type LeagueType = "F2P" | "STANDARD" | "UNLIMITED";

export interface League {
  id: string;
  name: string;
  type: LeagueType;
  description: string;
}

export type Role = "GUEST" | "USER" | "VERIFIED" | "JUDGE" | "SENIOR_JUDGE" | "ADMIN";
export type IdentityStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface User {
  id: string;
  handle: string;
  displayName: string;
  region: string;
  roles: Role[];
  trustScore: number;
  proxyLevel: number;
  verifiedStatus: IdentityStatus;
}

export interface IdentityProof {
  userId: string;
  uid: string;
  region: string;
  status: IdentityStatus;
  submittedAt: number;
  verifiedAt?: number;
}

export interface Agent {
  id: string;
  name: string;
  element: string;
  faction: string;
  role: string;
  iconUrl?: string;
}

export type RosterEvidenceLevel = "DECLARED" | "SCREEN_PROVED" | "VIDEO_PROVED";

export interface RosterAgent {
  agentId: string;
  owned: boolean;
  dupes?: number;
  signatureLevel?: number;
  level?: number;
  evidenceLevel: RosterEvidenceLevel;
}

export interface Roster {
  userId: string;
  agents: RosterAgent[];
  updatedAt: number;
}

export type ChallengeMetricType = "TIME_MS" | "SCORE" | "RANK_TIER";
export type ProofType = "IMAGE" | "VIDEO";

export interface Challenge {
  id: string;
  name: string;
  description: string;
  metricType: ChallengeMetricType;
  allowedProofs: ProofType[];
}

export type PrivacyMode = "MODE_A" | "MODE_B" | "MODE_C";

export interface EvidencePolicy {
  precheckRequired: boolean;
  inrunRequired: boolean;
  resultRequired: boolean;
  retentionDays: {
    precheck: number;
    inrun: number;
    result: number;
  };
}

export interface RulesetAgentPolicy {
  mode: "WHITELIST" | "BLACKLIST";
  agentIds: string[];
}

export interface RulesetLimitPolicy {
  mode: "ALLOW" | "DISALLOW" | "LIMIT";
  max?: number;
}

export interface Ruleset {
  id: string;
  leagueId: string;
  version: string;
  name: string;
  description: string;
  allowedAgents?: RulesetAgentPolicy;
  dupesPolicy?: RulesetLimitPolicy;
  signaturePolicy?: RulesetLimitPolicy;
  levelCaps?: {
    agentLevel?: number;
    skillLevel?: number;
  };
  gearCaps?: {
    diskLevel?: number;
    setLimit?: number;
  };
  requireVerifier: boolean;
  requireInrunCheck: boolean;
  evidencePolicy: EvidencePolicy;
  precheckFrequencySec: number;
  inrunFrequencySec: number;
  privacyMode: PrivacyMode;
}

export type MatchState =
  | "CREATED"
  | "CHECKIN"
  | "DRAFTING"
  | "AWAITING_PRECHECK"
  | "READY_TO_START"
  | "IN_PROGRESS"
  | "AWAITING_RESULT_UPLOAD"
  | "AWAITING_CONFIRMATION"
  | "DISPUTED"
  | "RESOLVED"
  | "CANCELED"
  | "EXPIRED";

export type DraftActionType =
  | "BAN_A"
  | "BAN_B"
  | "PICK_A"
  | "PICK_B"
  | "LOCK_A"
  | "LOCK_B";

export interface DraftAction {
  type: DraftActionType;
  agentId: string;
  userId: string;
  timestamp: number;
}

export interface DraftState {
  templateId: string;
  sequence: DraftActionType[];
  actions: DraftAction[];
  uniqueMode: "GLOBAL" | "OPPONENT";
}

export interface MatchPlayer {
  userId: string;
  side: "A" | "B";
  checkin: boolean;
}

export type EvidenceResult = "PASS" | "VIOLATION" | "LOW_CONF";
export type EvidenceType = "PRECHECK" | "INRUN" | "RESULT";

export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  timestamp: number;
  userId?: string;
  detectedAgents: string[];
  confidence: Record<string, number>;
  result: EvidenceResult;
  frameHash?: string;
  cropUrl?: string;
}

export interface ResultProof {
  metricType: ChallengeMetricType;
  value: number | string;
  proofUrl: string;
  submittedAt: number;
}

export interface Match {
  id: string;
  queueId?: string;
  state: MatchState;
  leagueId: string;
  rulesetId: string;
  challengeId: string;
  seasonId: string;
  players: MatchPlayer[];
  draft: DraftState;
  evidence: {
    precheck: EvidenceRecord[];
    inrun: EvidenceRecord[];
    result?: ResultProof;
  };
  confirmedBy: string[];
  createdAt: number;
  updatedAt: number;
}

export type DisputeStatus = "OPEN" | "RESOLVED" | "REJECTED";

export interface Dispute {
  id: string;
  matchId: string;
  openedBy: string;
  reason: string;
  status: DisputeStatus;
  decision?: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface Rating {
  userId: string;
  leagueId: string;
  elo: number;
  provisionalMatches: number;
  updatedAt: number;
}

export type SeasonStatus = "PLANNED" | "ACTIVE" | "ENDED";

export interface Season {
  id: string;
  name: string;
  status: SeasonStatus;
  startsAt: number;
  endsAt: number;
}

export interface QueueConfig {
  id: string;
  leagueId: string;
  rulesetId: string;
  challengeId: string;
  name: string;
  description: string;
  requireVerifier: boolean;
}
