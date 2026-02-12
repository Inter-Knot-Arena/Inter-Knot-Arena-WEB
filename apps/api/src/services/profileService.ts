import type {
  Agent,
  Match,
  ProfileAgentSummary,
  ProfileAnalytics,
  ProfileDisputeStatus,
  ProfileEvidenceStatus,
  ProfileMatchHistoryFilters,
  ProfileMatchHistoryItem,
  ProfileMatchHistoryPage,
  ProfileMatchResult,
  ProfileRosterPreviewItem,
  ProfileSummary,
  User
} from "@ika/shared";
import type { Repository } from "../repository/types.js";

interface ProfileViewOptions {
  viewer?: User | null;
  includeAnalytics?: boolean;
}

interface ProfileVisibility {
  canSeeUid: boolean;
  canSeeHistory: boolean;
}

export async function getProfileSummary(
  repo: Repository,
  userId: string,
  options: ProfileViewOptions = {}
): Promise<ProfileSummary> {
  const user = await repo.findUser(userId);
  const ratings = await repo.listRatingsByUser(userId);
  const visibility = resolveVisibility(user, options.viewer);
  const safeUser = sanitizeUser(user, visibility.canSeeUid);

  if (options.includeAnalytics === false) {
    return { user: safeUser, ratings };
  }

  const analytics = await getProfileAnalytics(repo, userId, options);
  return { user: safeUser, ratings, analytics };
}

export async function getProfileAnalytics(
  repo: Repository,
  userId: string,
  options: ProfileViewOptions = {}
): Promise<ProfileAnalytics> {
  const user = await repo.findUser(userId);
  const visibility = resolveVisibility(user, options.viewer);
  if (!visibility.canSeeHistory) {
    return buildEmptyAnalytics();
  }

  const matchHistory = await listProfileMatchHistory(repo, userId);
  const topAgents = await buildTopAgents(repo, userId, matchHistory);
  const rosterPreview = await buildRosterPreview(repo, topAgents);
  const draft = buildDraftSummary(matchHistory);
  const evidence = await buildEvidenceSummary(repo, userId, matchHistory);

  return {
    matchHistory,
    topAgents,
    rosterPreview,
    draft,
    evidence
  };
}

export async function getProfileMatchHistoryPage(
  repo: Repository,
  userId: string,
  filters: ProfileMatchHistoryFilters,
  page: number,
  pageSize: number,
  viewer?: User | null
): Promise<ProfileMatchHistoryPage> {
  const user = await repo.findUser(userId);
  const visibility = resolveVisibility(user, viewer);
  if (!visibility.canSeeHistory) {
    return {
      items: [],
      total: 0,
      page: normalizePage(page),
      pageSize: normalizePageSize(pageSize)
    };
  }

  const items = await listProfileMatchHistory(repo, userId);
  const filtered = applyMatchFilters(items, filters);
  const normalizedPage = normalizePage(page);
  const normalizedSize = normalizePageSize(pageSize);
  const offset = (normalizedPage - 1) * normalizedSize;
  const paged = filtered.slice(offset, offset + normalizedSize);

  return {
    items: paged,
    total: filtered.length,
    page: normalizedPage,
    pageSize: normalizedSize
  };
}

async function listProfileMatchHistory(
  repo: Repository,
  userId: string
): Promise<ProfileMatchHistoryItem[]> {
  const matches = await repo.listMatchesByUser(userId);
  const [leagues, challenges, users, disputes, agents] = await Promise.all([
    repo.listLeagues(),
    repo.listChallenges(),
    repo.listUsers(),
    repo.listDisputesByMatchIds(matches.map((match) => match.id)),
    repo.listAgents()
  ]);

  const leagueById = new Map(leagues.map((league) => [league.id, league]));
  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const disputeByMatch = new Map<string, ProfileDisputeStatus>();

  disputes.forEach((dispute) => {
    const existing = disputeByMatch.get(dispute.matchId);
    if (dispute.status === "OPEN") {
      disputeByMatch.set(dispute.matchId, "Open");
      return;
    }
    if (!existing) {
      disputeByMatch.set(dispute.matchId, "Resolved");
    }
  });

  return matches
    .map((match) => {
      const opponent = match.players.find((player) => player.userId !== userId);
      const opponentProfile = opponent ? userById.get(opponent.userId) : null;
      const league = leagueById.get(match.leagueId);
      const challenge = challengeById.get(match.challengeId);
      const result = resolveMatchResult(match, userId);
      const evidenceStatus = resolveEvidenceStatus(match);
      const eloDelta = match.resolution?.ratingDelta?.[userId] ?? 0;
      const evidenceLinks = resolveEvidenceLinks(match, userId);
      const draftSummary = buildDraftSummaryLine(match, userId, agentById);

      return {
        id: match.id,
        date: new Date(match.updatedAt).toISOString().slice(0, 10),
        dateTs: match.updatedAt,
        opponentUserId: opponent?.userId ?? "unknown",
        opponentDisplayName: opponentProfile?.displayName ?? opponent?.userId ?? "Unknown",
        leagueId: match.leagueId,
        leagueName: league?.name ?? match.leagueId,
        challengeId: match.challengeId,
        challengeName: challenge?.name ?? match.challengeId,
        result,
        eloDelta,
        evidenceStatus,
        disputeStatus: disputeByMatch.get(match.id) ?? "None",
        draftSummary,
        evidenceLinks
      } satisfies ProfileMatchHistoryItem;
    })
    .sort((a, b) => b.dateTs - a.dateTs);
}

async function buildTopAgents(
  repo: Repository,
  userId: string,
  matchHistory: ProfileMatchHistoryItem[]
): Promise<ProfileAgentSummary[]> {
  if (!matchHistory.length) {
    return [];
  }
  const matches = await repo.listMatchesByUser(userId);
  const agents = await repo.listAgents();
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const stats = new Map<string, { picks: number; wins: number; losses: number }>();

  matches.forEach((match) => {
    const won = match.resolution?.winnerUserId === userId;
    match.draft.actions
      .filter((action) => action.type.startsWith("PICK") && action.userId === userId)
      .forEach((action) => {
        const row = stats.get(action.agentId) ?? { picks: 0, wins: 0, losses: 0 };
        row.picks += 1;
        if (won) {
          row.wins += 1;
        } else {
          row.losses += 1;
        }
        stats.set(action.agentId, row);
      });
  });

  const totalPicks = Array.from(stats.values()).reduce((sum, item) => sum + item.picks, 0);
  if (totalPicks === 0) {
    return [];
  }

  return Array.from(stats.entries())
    .map(([agentId, row]) => {
      const agent = agentById.get(agentId);
      const winrate = row.picks > 0 ? Math.round((row.wins / row.picks) * 100) : 0;
      return {
        agentId,
        name: agent?.name ?? agentId,
        role: agent?.role ?? "Unknown",
        matches: row.picks,
        wins: row.wins,
        losses: row.losses,
        winrate,
        share: Number(((row.picks / totalPicks) * 100).toFixed(1))
      } satisfies ProfileAgentSummary;
    })
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 8);
}

async function buildRosterPreview(
  repo: Repository,
  topAgents: ProfileAgentSummary[]
): Promise<ProfileRosterPreviewItem[]> {
  const catalog = await repo.listAgents();
  const usage = new Map(topAgents.map((item) => [item.agentId, item.matches]));
  const topIds = new Set(topAgents.map((item) => item.agentId));

  const prioritized = [
    ...catalog.filter((agent) => topIds.has(agent.id)),
    ...catalog.filter((agent) => !topIds.has(agent.id))
  ];

  return prioritized.slice(0, 12).map((agent) => {
    const rankedUsage = usage.get(agent.id) ?? 0;
    const owned = rankedUsage > 0;
    return {
      id: agent.id,
      name: agent.name,
      element: agent.element,
      faction: agent.faction,
      role: agent.role,
      owned,
      verified: owned,
      draftEligible: owned,
      rankedUsage
    };
  });
}

function buildDraftSummary(matchHistory: ProfileMatchHistoryItem[]): ProfileAnalytics["draft"] {
  if (matchHistory.length === 0) {
    return {
      banFrequency: "-",
      pickFrequency: "-",
      draftWinrate: 0,
      matchWinrate: 0,
      pickSuccess: "-",
      yourBans: [],
      bansAgainst: [],
      sequences: [],
      winrateDelta: "-"
    };
  }

  const total = matchHistory.length;
  const wins = matchHistory.filter((match) => match.result === "W").length;
  const losses = matchHistory.filter((match) => match.result === "L").length;
  const matchWinrate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const draftWinrate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const delta = draftWinrate - matchWinrate;

  const yourBanCounts = new Map<string, number>();
  const againstBanCounts = new Map<string, number>();
  const sequences = new Map<string, number>();
  let banTotal = 0;
  let pickTotal = 0;

  matchHistory.forEach((match) => {
    const tokens = match.draftSummary.split(";");
    const yourBans = extractSummaryList(tokens, "Bans");
    const oppBans = extractSummaryList(tokens, "Against");
    const picks = extractSummaryList(tokens, "Picks");

    banTotal += yourBans.length;
    pickTotal += picks.length;

    yourBans.forEach((name) => {
      yourBanCounts.set(name, (yourBanCounts.get(name) ?? 0) + 1);
    });
    oppBans.forEach((name) => {
      againstBanCounts.set(name, (againstBanCounts.get(name) ?? 0) + 1);
    });
    if (yourBans.length >= 2) {
      const sequence = `${yourBans[0]} -> ${yourBans[1]}`;
      sequences.set(sequence, (sequences.get(sequence) ?? 0) + 1);
    } else if (yourBans.length === 1) {
      const sequence = `${yourBans[0]} -> --`;
      sequences.set(sequence, (sequences.get(sequence) ?? 0) + 1);
    }
  });

  return {
    banFrequency: (banTotal / total).toFixed(1),
    pickFrequency: (pickTotal / total).toFixed(1),
    draftWinrate,
    matchWinrate,
    pickSuccess: `${draftWinrate}%`,
    yourBans: topCountMap(yourBanCounts, 6),
    bansAgainst: topCountMap(againstBanCounts, 6),
    sequences: topCountMap(sequences, 6).map((item) => ({
      sequence: item.name,
      count: item.count
    })),
    winrateDelta: `${delta >= 0 ? "+" : ""}${delta}%`
  };
}

async function buildEvidenceSummary(
  repo: Repository,
  userId: string,
  matchHistory: ProfileMatchHistoryItem[]
): Promise<ProfileAnalytics["evidence"]> {
  const [matches, rulesets, leagues] = await Promise.all([
    repo.listMatchesByUser(userId),
    repo.listRulesets(),
    repo.listLeagues()
  ]);
  const rulesetById = new Map(rulesets.map((ruleset) => [ruleset.id, ruleset]));
  const leagueById = new Map(leagues.map((league) => [league.id, league]));

  const strictProofRequired = rulesets
    .filter((ruleset) => ruleset.requireVerifier)
    .map((ruleset) => leagueById.get(ruleset.leagueId)?.name ?? ruleset.leagueId)
    .filter((value, index, source) => source.indexOf(value) === index);

  const precheckRecords = matches
    .flatMap((match) =>
      match.evidence.precheck.filter((record) => record.userId === userId)
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  const latestPrecheck = precheckRecords[0];
  const lastPrecheck = latestPrecheck
    ? new Date(latestPrecheck.timestamp).toISOString().replace("T", " ").slice(0, 16)
    : "No checks yet";
  const lastPrecheckStatus =
    latestPrecheck?.result === "PASS"
      ? "PASS"
      : latestPrecheck?.result === "VIOLATION"
        ? "FAIL"
        : "NONE";

  const inrunViolations = matches.reduce((count, match) => {
    return (
      count +
      match.evidence.inrun.filter(
        (record) => record.userId === userId && record.result === "VIOLATION"
      ).length
    );
  }, 0);

  const evidenceItems = matchHistory.slice(0, 10).map((match) => {
    const originMatch = matches.find((item) => item.id === match.id);
    const ruleset = originMatch ? rulesetById.get(originMatch.rulesetId) : null;
    const retentionDays = ruleset?.evidencePolicy.retentionDays.result ?? 30;
    const ageDays = Math.max(0, Math.floor((Date.now() - match.dateTs) / (1000 * 60 * 60 * 24)));
    const status: "Stored" | "Expiring" | "Requested" =
      match.evidenceStatus === "Missing"
        ? "Requested"
        : ageDays >= Math.max(retentionDays - 7, 1)
          ? "Expiring"
          : "Stored";
    return {
      id: `${match.id}-result`,
      match: `${match.leagueName} vs ${match.opponentDisplayName}`,
      type: "Result proof",
      date: match.date,
      status,
      retention: `${retentionDays} days`
    };
  });

  return {
    strictProofRequired,
    lastPrecheck,
    lastPrecheckStatus,
    inrunViolations,
    evidenceItems,
    retentionInfo: "Pre/in-run crops are kept for 14 days. Result proofs are kept for 30-90 days."
  };
}

function resolveVisibility(user: User, viewer?: User | null): ProfileVisibility {
  const isSelf = Boolean(viewer && viewer.id === user.id);
  const isModer =
    viewer?.roles.includes("MODER") ||
    viewer?.roles.includes("STAFF") ||
    viewer?.roles.includes("ADMIN");
  return {
    canSeeUid: Boolean(isSelf || isModer || user.privacy.showUidPublicly),
    canSeeHistory: Boolean(isSelf || isModer || user.privacy.showMatchHistoryPublicly)
  };
}

function sanitizeUser(user: User, canSeeUid: boolean): User {
  if (canSeeUid) {
    return user;
  }
  return {
    ...user,
    verification: {
      ...user.verification,
      uid: undefined
    }
  };
}

function buildEmptyAnalytics(): ProfileAnalytics {
  return {
    matchHistory: [],
    topAgents: [],
    rosterPreview: [],
    draft: {
      banFrequency: "-",
      pickFrequency: "-",
      draftWinrate: 0,
      matchWinrate: 0,
      pickSuccess: "-",
      yourBans: [],
      bansAgainst: [],
      sequences: [],
      winrateDelta: "-"
    },
    evidence: {
      strictProofRequired: ["Standard", "F2P"],
      lastPrecheck: "No checks yet",
      lastPrecheckStatus: "NONE",
      inrunViolations: 0,
      evidenceItems: [],
      retentionInfo: "Pre/in-run crops are kept for 14 days. Result proofs are kept for 30-90 days."
    }
  };
}

function resolveMatchResult(match: Match, userId: string): ProfileMatchResult {
  const winner = match.resolution?.winnerUserId ?? match.evidence.result?.winnerUserId;
  if (!winner) {
    return "DRAW";
  }
  return winner === userId ? "W" : "L";
}

function resolveEvidenceStatus(match: Match): ProfileEvidenceStatus {
  const result = match.evidence.result;
  if (!result) {
    return "Missing";
  }
  const entryCount = result.entries?.length ?? 0;
  if (entryCount >= match.players.length) {
    return "Verified";
  }
  if (result.proofUrl || entryCount > 0) {
    return "Pending";
  }
  return "Missing";
}

function resolveEvidenceLinks(match: Match, userId: string): string[] {
  const links = new Set<string>();
  const result = match.evidence.result;
  if (result?.proofUrl) {
    links.add(result.proofUrl);
  }
  result?.entries?.forEach((entry) => {
    if (entry.proofUrl) {
      links.add(entry.proofUrl);
    }
    if (entry.demoUrl) {
      links.add(entry.demoUrl);
    }
  });
  match.evidence.precheck
    .filter((record) => record.userId === userId && record.cropUrl)
    .forEach((record) => {
      if (record.cropUrl) {
        links.add(record.cropUrl);
      }
    });
  return Array.from(links).slice(0, 6);
}

function buildDraftSummaryLine(
  match: Match,
  userId: string,
  agentById: Map<string, Agent>
): string {
  const picks = match.draft.actions
    .filter((action) => action.type.startsWith("PICK") && action.userId === userId)
    .map((action) => agentById.get(action.agentId)?.name ?? action.agentId);
  const bans = match.draft.actions
    .filter((action) => action.type.startsWith("BAN") && action.userId === userId)
    .map((action) => agentById.get(action.agentId)?.name ?? action.agentId);
  const against = match.draft.actions
    .filter((action) => action.type.startsWith("BAN") && action.userId !== userId)
    .map((action) => agentById.get(action.agentId)?.name ?? action.agentId);

  const picksText = picks.length ? picks.join(", ") : "--";
  const bansText = bans.length ? bans.join(", ") : "--";
  const againstText = against.length ? against.join(", ") : "--";
  return `Picks: ${picksText}; Bans: ${bansText}; Against: ${againstText}`;
}

function applyMatchFilters(
  items: ProfileMatchHistoryItem[],
  filters: ProfileMatchHistoryFilters
): ProfileMatchHistoryItem[] {
  return items.filter((item) => {
    if (filters.leagueId && item.leagueId !== filters.leagueId) {
      return false;
    }
    if (filters.result && item.result !== filters.result) {
      return false;
    }
    if (filters.evidenceStatus && item.evidenceStatus !== filters.evidenceStatus) {
      return false;
    }
    if (filters.challengeId && item.challengeId !== filters.challengeId) {
      return false;
    }
    if (filters.startDateTs && item.dateTs < filters.startDateTs) {
      return false;
    }
    if (filters.endDateTs && item.dateTs > filters.endDateTs) {
      return false;
    }
    return true;
  });
}

function normalizePage(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.trunc(value);
}

function normalizePageSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 20;
  }
  return Math.min(100, Math.trunc(value));
}

function topCountMap(source: Map<string, number>, limit: number): Array<{ name: string; count: number }> {
  return Array.from(source.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function extractSummaryList(tokens: string[], section: string): string[] {
  const prefix = `${section}:`;
  const token = tokens.find((part) => part.trim().startsWith(prefix));
  if (!token) {
    return [];
  }
  const values = token.slice(token.indexOf(":") + 1).trim();
  if (!values || values === "--") {
    return [];
  }
  return values
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
