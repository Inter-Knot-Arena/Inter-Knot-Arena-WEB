export type LeagueType = "F2P" | "STANDARD" | "UNLIMITED";

export interface League {
  id: string;
  name: string;
  type: LeagueType;
  description: string;
}

export type Role = "USER" | "VERIFIED" | "ADMIN" | "STAFF" | "MODER";
export type IdentityStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type Region = "NA" | "EU" | "ASIA" | "SEA" | "OTHER";

export interface ProxyLevel {
  level: number;
  xp: number;
  nextXp: number;
}

export interface UserVerification {
  status: IdentityStatus;
  region?: string;
  uid?: string;
}

export interface UserPrivacy {
  showUidPublicly: boolean;
  showMatchHistoryPublicly: boolean;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  region: Region;
  createdAt: number;
  updatedAt: number;
  roles: Role[];
  trustScore: number;
  proxyLevel: ProxyLevel;
  verification: UserVerification;
  privacy: UserPrivacy;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export interface OAuthAccount {
  provider: "google";
  providerAccountId: string;
  userId: string;
  email: string;
}

export interface PasswordAccount {
  userId: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
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

export type AgentAttribute = "ICE" | "FIRE" | "ELECTRIC" | "ETHER" | "PHYSICAL";
export type AgentRole = "ATTACK" | "STUN" | "SUPPORT" | "DEFENSE" | "ANOMALY";
export type AgentAttackType = "MELEE" | "RANGED" | "BURST" | "SUSTAIN";
export type AgentRarity = "A" | "S";

export interface AgentStatic {
  agentId: string;
  name: string;
  attribute: AgentAttribute;
  faction: string;
  role: AgentRole;
  attackType: AgentAttackType;
  rarity: AgentRarity;
  tags: string[];
  iconKey: string;
  shortDescription?: string;
  catalogVersion: string;
}

export interface AgentCatalog {
  catalogVersion: string;
  agents: AgentStatic[];
}

export interface DiscSet {
  discSetId: string;
  gameId: number;
  name: string;
  twoPieceBonus?: string;
  fourPieceBonus?: string;
  iconKey?: string;
  iconPath?: string;
  tags?: string[];
}

export interface DiscSetCatalog {
  catalogVersion: string;
  discSets: DiscSet[];
}

export type PlayerAgentSource = "ENKA_SHOWCASE" | "VERIFIER_OCR" | "MANUAL";

export interface DiscProperty {
  propertyId: number;
  level?: number;
  value?: number | string;
}

export interface PlayerAgentDisc {
  discId: string;
  slot?: number;
  set?: string;
  mainStat?: string;
  subStats?: string[];
  pieceGameId?: number;
  setGameId?: number;
  setId?: string;
  setName?: string;
  setIconKey?: string;
  mainProps?: DiscProperty[];
  subProps?: DiscProperty[];
  level?: number;
  breakLevel?: number;
  isLocked?: boolean;
}

export interface PlayerAgentDynamic {
  agentId: string;
  agentGameId?: number;
  owned: boolean;
  level?: number;
  dupes?: number;
  promotion?: number;
  talent?: number;
  core?: number;
  weapon?: { weaponId: string; gameId?: number; level?: number; breakLevel?: number; rarity?: string };
  discs?: PlayerAgentDisc[];
  skills?: Record<string, number>;
  mindscape?: number;
  source: PlayerAgentSource;
  confidence?: Record<string, number>;
  lastImportedAt?: string;
  lastShowcaseSeenAt?: string;
  updatedAt: string;
}

export interface AgentEligibility {
  draftEligible: boolean;
  reasons: string[];
}

export interface PlayerRosterImportSummary {
  source: PlayerAgentSource;
  importedCount: number;
  skippedCount: number;
  unknownIds: string[];
  fetchedAt: string;
  newAgentsCount?: number;
  updatedAgentsCount?: number;
  unchangedCount?: number;
  ttlSeconds?: number;
  message?: string;
}

export interface PlayerRosterView {
  uid: string;
  region: Region;
  catalogVersion: string;
  agents: Array<{
    agent: AgentStatic;
    state?: PlayerAgentDynamic;
    eligibility: AgentEligibility;
  }>;
  lastImport?: PlayerRosterImportSummary;
}

export interface EnkaMapping {
  mappingVersion: string;
  characters: Record<string, string>;
  weapons: Record<string, string>;
  discs: Record<string, string>;
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
  submittedAt: number;
  value?: number | string;
  proofUrl?: string;
  userId?: string;
  entries?: Array<{
    userId: string;
    value: number | string;
    proofUrl: string;
    demoUrl?: string;
    submittedAt: number;
  }>;
  winnerUserId?: string;
  notes?: string;
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
  resolution?: {
    finalizedAt: number;
    source: "CONFIRMATION" | "MODERATION";
    winnerUserId?: string;
    ratingDelta?: Record<string, number>;
    trustDelta?: Record<string, number>;
    proxyXpDelta?: Record<string, number>;
  };
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
  evidenceUrls?: string[];
  resolvedBy?: string;
  winnerUserId?: string;
  createdAt: number;
  resolvedAt?: number;
}

export type SanctionType = "WARNING" | "TIME_BAN" | "SEASON_BAN" | "ELO_ROLLBACK";
export type SanctionStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface Sanction {
  id: string;
  userId: string;
  type: SanctionType;
  status: SanctionStatus;
  reason: string;
  issuedBy?: string;
  matchId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
}

export interface RankBand {
  id: string;
  name: string;
  minElo: number;
  maxElo?: number;
  badge?: string;
  sortOrder: number;
}

export interface Rating {
  userId: string;
  leagueId: string;
  elo: number;
  provisionalMatches: number;
  updatedAt: number;
}

export interface ProfileSummary {
  user: User;
  ratings: Rating[];
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
