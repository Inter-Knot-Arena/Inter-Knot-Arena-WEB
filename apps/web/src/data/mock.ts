import type {
  Agent,
  League,
  Match,
  ProfileSummary,
  QueueConfig,
  Rating,
  Ruleset,
  User
} from "@ika/shared";

const now = Date.now();

export const leagues: League[] = [
  {
    id: "league_f2p",
    name: "F2P",
    type: "F2P",
    description: "Strict caps and verified-only queues."
  },
  {
    id: "league_standard",
    name: "Standard",
    type: "STANDARD",
    description: "Balanced competitive ruleset with strict evidence checks."
  },
  {
    id: "league_unlimited",
    name: "Unlimited",
    type: "UNLIMITED",
    description: "No restrictions beyond match proof."
  }
];

export const users: User[] = [
  {
    id: "user_ellen",
    email: "ellen@interknot.dev",
    displayName: "Ellen",
    avatarUrl: null,
    region: "NA",
    createdAt: now,
    updatedAt: now,
    roles: ["USER", "VERIFIED"],
    trustScore: 128,
    proxyLevel: { level: 12, xp: 420, nextXp: 600 },
    verification: { status: "VERIFIED", region: "NA", uid: "123456789" },
    privacy: { showUidPublicly: true, showMatchHistoryPublicly: true }
  },
  {
    id: "user_lycaon",
    email: "lycaon@interknot.dev",
    displayName: "Lycaon",
    avatarUrl: null,
    region: "EU",
    createdAt: now,
    updatedAt: now,
    roles: ["USER", "VERIFIED"],
    trustScore: 114,
    proxyLevel: { level: 10, xp: 220, nextXp: 400 },
    verification: { status: "VERIFIED", region: "EU", uid: "987654321" },
    privacy: { showUidPublicly: false, showMatchHistoryPublicly: true }
  },
  {
    id: "user_nicole",
    email: "nicole@interknot.dev",
    displayName: "Nicole",
    avatarUrl: null,
    region: "ASIA",
    createdAt: now,
    updatedAt: now,
    roles: ["USER"],
    trustScore: 98,
    proxyLevel: { level: 6, xp: 80, nextXp: 200 },
    verification: { status: "UNVERIFIED" },
    privacy: { showUidPublicly: false, showMatchHistoryPublicly: false }
  },
  {
    id: "user_anby",
    email: "anby@interknot.dev",
    displayName: "Anby",
    avatarUrl: null,
    region: "NA",
    createdAt: now,
    updatedAt: now,
    roles: ["USER"],
    trustScore: 102,
    proxyLevel: { level: 7, xp: 120, nextXp: 220 },
    verification: { status: "PENDING", region: "NA" },
    privacy: { showUidPublicly: false, showMatchHistoryPublicly: true }
  }
];

export const ratings: Rating[] = [
  {
    userId: "user_ellen",
    leagueId: "league_standard",
    elo: 1684,
    provisionalMatches: 12,
    updatedAt: now
  },
  {
    userId: "user_lycaon",
    leagueId: "league_standard",
    elo: 1542,
    provisionalMatches: 8,
    updatedAt: now
  },
  {
    userId: "user_nicole",
    leagueId: "league_standard",
    elo: 1428,
    provisionalMatches: 9,
    updatedAt: now
  },
  {
    userId: "user_anby",
    leagueId: "league_standard",
    elo: 1394,
    provisionalMatches: 10,
    updatedAt: now
  },
  {
    userId: "user_ellen",
    leagueId: "league_f2p",
    elo: 1402,
    provisionalMatches: 9,
    updatedAt: now
  },
  {
    userId: "user_lycaon",
    leagueId: "league_unlimited",
    elo: 1705,
    provisionalMatches: 15,
    updatedAt: now
  }
];

export const profiles: ProfileSummary[] = users.map((user) => ({
  user,
  ratings: ratings.filter((rating) => rating.userId === user.id)
}));

export const agents: Agent[] = [
  {
    id: "agent_ellen",
    name: "Ellen",
    element: "Ice",
    faction: "Victoria Housekeeping",
    role: "Attack"
  },
  {
    id: "agent_lycaon",
    name: "Lycaon",
    element: "Ice",
    faction: "Victoria Housekeeping",
    role: "Stun"
  },
  {
    id: "agent_nicole",
    name: "Nicole",
    element: "Ether",
    faction: "Cunning Hares",
    role: "Support"
  },
  {
    id: "agent_anby",
    name: "Anby",
    element: "Electric",
    faction: "Cunning Hares",
    role: "Stun"
  },
  {
    id: "agent_billy",
    name: "Billy",
    element: "Physical",
    faction: "Cunning Hares",
    role: "Attack"
  },
  {
    id: "agent_zhu_yuan",
    name: "Zhu Yuan",
    element: "Ether",
    faction: "Public Security",
    role: "Attack"
  }
];

export const rulesets: Ruleset[] = [
  {
    id: "ruleset_f2p_v1",
    leagueId: "league_f2p",
    version: "v1.0",
    name: "F2P v1.0",
    description: "Strict ownership limits and roster proof.",
    requireVerifier: true,
    requireInrunCheck: false,
    evidencePolicy: {
      precheckRequired: true,
      inrunRequired: false,
      resultRequired: true,
      retentionDays: {
        precheck: 14,
        inrun: 14,
        result: 60
      }
    },
    precheckFrequencySec: 5,
    inrunFrequencySec: 15,
    privacyMode: "MODE_B",
    levelCaps: { agentLevel: 60 },
    dupesPolicy: { mode: "LIMIT", max: 1 },
    signaturePolicy: { mode: "DISALLOW" }
  },
  {
    id: "ruleset_standard_v1",
    leagueId: "league_standard",
    version: "v1.0",
    name: "Standard v1.0",
    description: "Strict pre-check and in-run evidence checks.",
    requireVerifier: true,
    requireInrunCheck: true,
    evidencePolicy: {
      precheckRequired: true,
      inrunRequired: true,
      resultRequired: true,
      retentionDays: {
        precheck: 14,
        inrun: 14,
        result: 90
      }
    },
    precheckFrequencySec: 5,
    inrunFrequencySec: 12,
    privacyMode: "MODE_B",
    levelCaps: { agentLevel: 60 },
    gearCaps: { diskLevel: 12 }
  },
  {
    id: "ruleset_unlimited_v1",
    leagueId: "league_unlimited",
    version: "v1.0",
    name: "Unlimited v1.0",
    description: "Open queue with result proof only.",
    requireVerifier: false,
    requireInrunCheck: false,
    evidencePolicy: {
      precheckRequired: false,
      inrunRequired: false,
      resultRequired: true,
      retentionDays: {
        precheck: 7,
        inrun: 7,
        result: 30
      }
    },
    precheckFrequencySec: 5,
    inrunFrequencySec: 15,
    privacyMode: "MODE_A",
    levelCaps: { agentLevel: 60 }
  }
];

export const queues: QueueConfig[] = [
  {
    id: "queue_standard_weekly",
    leagueId: "league_standard",
    rulesetId: "ruleset_standard_v1",
    challengeId: "challenge_weekly_12",
    name: "Standard Weekly",
    description: "Strict-evidence weekly time trial.",
    requireVerifier: true
  },
  {
    id: "queue_f2p_score",
    leagueId: "league_f2p",
    rulesetId: "ruleset_f2p_v1",
    challengeId: "challenge_score_08",
    name: "F2P Score Rush",
    description: "Roster checks, low-spend caps, fast reporting.",
    requireVerifier: true
  },
  {
    id: "queue_unlimited_weekly",
    leagueId: "league_unlimited",
    rulesetId: "ruleset_unlimited_v1",
    challengeId: "challenge_weekly_12",
    name: "Unlimited Weekly",
    description: "Open queue with proof submission.",
    requireVerifier: false
  }
];

export const lobbyStats = [
  { leagueId: "league_f2p", waiting: 3, inProgress: 1 },
  { leagueId: "league_standard", waiting: 6, inProgress: 2 },
  { leagueId: "league_unlimited", waiting: 2, inProgress: 1 }
];

export const leaderboard: Rating[] = ratings
  .filter((item) => item.leagueId === "league_standard")
  .slice()
  .sort((a, b) => b.elo - a.elo);

export const demoMatch: Match = {
  id: "match_demo",
  queueId: "queue_standard_weekly",
  state: "AWAITING_PRECHECK",
  leagueId: "league_standard",
  rulesetId: "ruleset_standard_v1",
  challengeId: "challenge_weekly_12",
  seasonId: "season_01",
  players: [
    { userId: "user_ellen", side: "A", checkin: true },
    { userId: "user_lycaon", side: "B", checkin: true }
  ],
  draft: {
    templateId: "bo1-standard",
    sequence: [
      "BAN_A",
      "BAN_B",
      "PICK_A",
      "PICK_B",
      "PICK_A",
      "PICK_B",
      "PICK_A",
      "PICK_B"
    ],
    actions: [
      { type: "BAN_A", agentId: "agent_lycaon", userId: "user_ellen", timestamp: now - 400000 },
      { type: "BAN_B", agentId: "agent_ellen", userId: "user_lycaon", timestamp: now - 395000 },
      { type: "PICK_A", agentId: "agent_anby", userId: "user_ellen", timestamp: now - 380000 },
      { type: "PICK_B", agentId: "agent_billy", userId: "user_lycaon", timestamp: now - 370000 },
      { type: "PICK_A", agentId: "agent_nicole", userId: "user_ellen", timestamp: now - 360000 }
    ],
    uniqueMode: "GLOBAL"
  },
  evidence: {
    precheck: [],
    inrun: [],
    result: undefined
  },
  confirmedBy: [],
  createdAt: now - 600000,
  updatedAt: now - 120000
};
