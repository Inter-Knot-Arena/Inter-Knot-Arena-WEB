import type {
  Agent,
  Challenge,
  League,
  QueueConfig,
  Rating,
  Ruleset,
  Season,
  User
} from "@ika/shared";

const now = Date.now();

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
    description: "Balanced competitive ruleset with enforced verifier."
  },
  {
    id: "league_unlimited",
    name: "Unlimited",
    type: "UNLIMITED",
    description: "No restrictions beyond match proof."
  }
];

export const rulesets: Ruleset[] = [
  {
    id: "ruleset_f2p_v1",
    leagueId: "league_f2p",
    version: "v1.0",
    name: "F2P v1.0",
    description: "Entry ruleset with strict ownership caps.",
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
    dupesPolicy: { mode: "LIMIT", max: 1 },
    signaturePolicy: { mode: "DISALLOW" }
  },
  {
    id: "ruleset_standard_v1",
    leagueId: "league_standard",
    version: "v1.0",
    name: "Standard v1.0",
    description: "Competitive ruleset with verifier and in-run checks.",
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
    description: "Open ruleset with minimal restrictions.",
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
    privacyMode: "MODE_A"
  }
];

export const challenges: Challenge[] = [
  {
    id: "challenge_weekly_12",
    name: "Weekly Challenge #12",
    description: "Clear the current weekly boss on hard mode.",
    metricType: "TIME_MS",
    allowedProofs: ["IMAGE", "VIDEO"]
  },
  {
    id: "challenge_score_08",
    name: "Score Rush #8",
    description: "Reach the highest score in the featured combat stage.",
    metricType: "SCORE",
    allowedProofs: ["IMAGE", "VIDEO"]
  }
];

export const seasons: Season[] = [
  {
    id: "season_01",
    name: "Season 01",
    status: "ACTIVE",
    startsAt: now - 1000 * 60 * 60 * 24 * 10,
    endsAt: now + 1000 * 60 * 60 * 24 * 60
  }
];

export const users: User[] = [
  {
    id: "user_ellen",
    handle: "Ellen",
    displayName: "Ellen",
    region: "NA",
    roles: ["USER", "VERIFIED"],
    trustScore: 128,
    proxyLevel: 12,
    verifiedStatus: "VERIFIED"
  },
  {
    id: "user_lycaon",
    handle: "Lycaon",
    displayName: "Lycaon",
    region: "EU",
    roles: ["USER", "VERIFIED"],
    trustScore: 114,
    proxyLevel: 10,
    verifiedStatus: "VERIFIED"
  },
  {
    id: "user_nicole",
    handle: "Nicole",
    displayName: "Nicole",
    region: "ASIA",
    roles: ["USER"],
    trustScore: 98,
    proxyLevel: 6,
    verifiedStatus: "UNVERIFIED"
  },
  {
    id: "user_anby",
    handle: "Anby",
    displayName: "Anby",
    region: "NA",
    roles: ["USER"],
    trustScore: 102,
    proxyLevel: 7,
    verifiedStatus: "PENDING"
  }
];

export const ratings: Rating[] = [
  {
    userId: "user_ellen",
    leagueId: "league_standard",
    elo: 1620,
    provisionalMatches: 12,
    updatedAt: now
  },
  {
    userId: "user_lycaon",
    leagueId: "league_standard",
    elo: 1490,
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
    userId: "user_nicole",
    leagueId: "league_unlimited",
    elo: 1020,
    provisionalMatches: 3,
    updatedAt: now
  }
];

export const queues: QueueConfig[] = [
  {
    id: "queue_standard_weekly",
    leagueId: "league_standard",
    rulesetId: "ruleset_standard_v1",
    challengeId: "challenge_weekly_12",
    name: "Standard Weekly",
    description: "Verifier-required weekly time trial.",
    requireVerifier: true
  },
  {
    id: "queue_f2p_score",
    leagueId: "league_f2p",
    rulesetId: "ruleset_f2p_v1",
    challengeId: "challenge_score_08",
    name: "F2P Score Rush",
    description: "Low-spend score chase with roster checks.",
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
