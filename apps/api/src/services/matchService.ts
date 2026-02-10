import type {
  ChallengeMetricType,
  Dispute,
  DraftAction,
  EvidenceRecord,
  Match,
  MatchState,
  Rating,
  ResultProof,
  User
} from "@ika/shared";
import {
  applyEloResult,
  canTransition,
  defaultEloConfig,
  getDraftTemplate,
  isDraftComplete,
  listDraftAgents,
  nextDraftAction
} from "@ika/shared";
import type { Repository } from "../repository/types.js";
import { createId, now } from "../utils.js";

type ResultEntry = NonNullable<ResultProof["entries"]>[number];

export interface FinalizeOverrides {
  trustDelta?: Record<string, number>;
  proxyXpDelta?: Record<string, number>;
}

export async function createMatchFromQueue(
  repo: Repository,
  queueId: string,
  userId: string,
  opponentUserId?: string
): Promise<Match> {
  const queue = await repo.findQueue(queueId);
  const player = await repo.findUser(userId);
  const season = await repo.getActiveSeason();
  const template = getDraftTemplate("bo1-standard");
  const opponent = opponentUserId
    ? await repo.findUser(opponentUserId)
    : (await repo.findOpponent(userId)) ?? (await repo.findUser(userId));

  if (queue.requireVerifier) {
    if (player.verification.status !== "VERIFIED") {
      throw new Error("This queue requires UID verification.");
    }
    if (opponent.verification.status !== "VERIFIED") {
      throw new Error("Opponent is not eligible for this UID-verified queue.");
    }
  }

  const match: Match = {
    id: createId("match"),
    queueId: queue.id,
    state: "CHECKIN",
    leagueId: queue.leagueId,
    rulesetId: queue.rulesetId,
    challengeId: queue.challengeId,
    seasonId: season.id,
    players: [
      { userId, side: "A", checkin: false },
      { userId: opponent.id, side: "B", checkin: false }
    ],
    draft: {
      templateId: template.id,
      sequence: template.sequence,
      actions: [],
      uniqueMode: template.uniqueMode
    },
    evidence: {
      precheck: [],
      inrun: []
    },
    confirmedBy: [],
    createdAt: now(),
    updatedAt: now()
  };

  await repo.createMatch(match);
  return match;
}

export async function markCheckin(
  repo: Repository,
  matchId: string,
  userId: string
): Promise<Match> {
  const match = await repo.findMatch(matchId);
  const player = match.players.find((item) => item.userId === userId);
  if (!player) {
    throw new Error("Player not found in match");
  }
  player.checkin = true;
  match.updatedAt = now();

  const allReady = match.players.every((item) => item.checkin);
  if (allReady && match.state === "CHECKIN") {
    transitionMatch(match, "DRAFTING");
  }

  await repo.saveMatch(match);
  return match;
}

export async function applyDraftAction(
  repo: Repository,
  matchId: string,
  action: DraftAction
): Promise<Match> {
  const match = await repo.findMatch(matchId);
  const expected = nextDraftAction(getDraftTemplate(match.draft.templateId), match.draft.actions);
  if (!expected) {
    throw new Error("Draft already complete");
  }
  if (expected !== action.type) {
    throw new Error(`Expected draft action ${expected}`);
  }

  const side = action.type.endsWith("_A") ? "A" : "B";
  const player = match.players.find((item) => item.side === side);
  if (!player || player.userId !== action.userId) {
    throw new Error("Player cannot perform this draft action");
  }

  const ruleset = await repo.findRuleset(match.rulesetId);
  if (ruleset.allowedAgents) {
    const listed = ruleset.allowedAgents.agentIds.includes(action.agentId);
    if (ruleset.allowedAgents.mode === "WHITELIST" && !listed) {
      throw new Error("Agent is not allowed in this ruleset");
    }
    if (ruleset.allowedAgents.mode === "BLACKLIST" && listed) {
      throw new Error("Agent is banned in this ruleset");
    }
  }

  const takenAgents = match.draft.actions.map((item) => item.agentId);
  if (takenAgents.includes(action.agentId)) {
    throw new Error("Agent already selected or banned");
  }

  if (action.type.startsWith("PICK") && match.draft.uniqueMode === "GLOBAL") {
    const pickedAgents = listDraftAgents(match.draft.actions);
    if (pickedAgents.includes(action.agentId)) {
      throw new Error("Agent already picked in this draft");
    }
  }

  match.draft.actions.push(action);
  match.updatedAt = now();

  if (isDraftComplete(getDraftTemplate(match.draft.templateId), match.draft.actions)) {
    if (ruleset.evidencePolicy.precheckRequired) {
      transitionMatch(match, "AWAITING_PRECHECK");
    } else {
      transitionMatch(match, "READY_TO_START");
    }
  }

  await repo.saveMatch(match);
  return match;
}

export async function recordPrecheck(
  repo: Repository,
  matchId: string,
  record: EvidenceRecord
): Promise<Match> {
  const match = await repo.findMatch(matchId);
  const ruleset = await repo.findRuleset(match.rulesetId);
  match.evidence.precheck.push(record);
  match.updatedAt = now();

  if (record.result === "VIOLATION") {
    await ensureAutoDispute(repo, match, record.userId, "Pre-check violation detected.");
    if (match.state !== "DISPUTED") {
      transitionMatch(match, "DISPUTED");
    }
    await repo.saveMatch(match);
    return match;
  }

  const passedUsers = new Set(
    match.evidence.precheck
      .filter((item) => item.result === "PASS" && item.userId)
      .map((item) => item.userId as string)
  );

  const requiredUsers = ruleset.evidencePolicy.precheckRequired
    ? match.players.map((player) => player.userId)
    : [];

  const allUsersPassed = requiredUsers.every((userId) => passedUsers.has(userId));
  if (match.state === "AWAITING_PRECHECK" && allUsersPassed) {
    transitionMatch(match, "READY_TO_START");
  }

  await repo.saveMatch(match);
  return match;
}

export async function recordInrun(
  repo: Repository,
  matchId: string,
  record: EvidenceRecord
): Promise<Match> {
  const match = await repo.findMatch(matchId);
  const ruleset = await repo.findRuleset(match.rulesetId);
  match.evidence.inrun.push(record);
  match.updatedAt = now();

  if (record.result === "VIOLATION" && ruleset.requireInrunCheck) {
    await ensureAutoDispute(repo, match, record.userId, "In-run violation detected.");
    if (match.state !== "DISPUTED") {
      transitionMatch(match, "DISPUTED");
    }
    await repo.saveMatch(match);
    return match;
  }

  if (match.state === "READY_TO_START") {
    transitionMatch(match, "IN_PROGRESS");
  }

  await repo.saveMatch(match);
  return match;
}

export async function recordResult(
  repo: Repository,
  matchId: string,
  result: ResultProof
): Promise<Match> {
  const match = await repo.findMatch(matchId);
  const mergedResult = mergeResultProof(match.evidence.result, result);

  if (match.state === "READY_TO_START") {
    transitionMatch(match, "IN_PROGRESS");
  }
  if (match.state === "IN_PROGRESS") {
    transitionMatch(match, "AWAITING_RESULT_UPLOAD");
  }

  match.evidence.result = mergedResult;
  match.updatedAt = now();
  if (match.state === "AWAITING_RESULT_UPLOAD" && hasAnyResultEntry(match.evidence.result)) {
    transitionMatch(match, "AWAITING_CONFIRMATION");
  }

  await repo.saveMatch(match);
  return match;
}

export async function confirmMatch(
  repo: Repository,
  matchId: string,
  userId: string
): Promise<Match> {
  const match = await repo.findMatch(matchId);
  if (!match.confirmedBy.includes(userId)) {
    match.confirmedBy.push(userId);
  }
  match.updatedAt = now();

  if (match.state === "AWAITING_CONFIRMATION" && match.confirmedBy.length >= match.players.length) {
    transitionMatch(match, "RESOLVED");
    await finalizeMatchResolution(repo, match, "CONFIRMATION");
    return match;
  }

  await repo.saveMatch(match);
  return match;
}

export async function openDispute(
  repo: Repository,
  matchId: string,
  userId: string,
  reason: string,
  evidenceUrls?: string[]
): Promise<Dispute> {
  const match = await repo.findMatch(matchId);
  const dispute: Dispute = {
    id: createId("dispute"),
    matchId: match.id,
    openedBy: userId,
    reason,
    status: "OPEN",
    evidenceUrls,
    createdAt: now()
  };
  await repo.createDispute(dispute);

  if (match.state !== "DISPUTED") {
    transitionMatch(match, "DISPUTED");
    await repo.saveMatch(match);
  }

  return dispute;
}

export async function resolveDispute(
  repo: Repository,
  disputeId: string,
  decision: string,
  resolvedBy: string,
  winnerUserId?: string
): Promise<Dispute> {
  const dispute = await repo.findDispute(disputeId);
  dispute.status = "RESOLVED";
  dispute.decision = decision;
  dispute.resolvedBy = resolvedBy;
  dispute.winnerUserId = winnerUserId;
  dispute.resolvedAt = now();

  await repo.saveDispute(dispute);

  const match = await repo.findMatch(dispute.matchId);
  if (match.state === "DISPUTED") {
    transitionMatch(match, "RESOLVED");
    await finalizeMatchResolution(repo, match, "MODERATION", winnerUserId);
  }

  return dispute;
}

export async function forceResolveMatch(
  repo: Repository,
  matchId: string,
  winnerUserId?: string,
  overrides?: FinalizeOverrides
): Promise<Match> {
  const match = await repo.findMatch(matchId);
  if (match.state !== "RESOLVED") {
    if (!canTransition(match.state, "RESOLVED")) {
      throw new Error(`Cannot force-resolve from state ${match.state}`);
    }
    transitionMatch(match, "RESOLVED");
  }
  await finalizeMatchResolution(repo, match, "MODERATION", winnerUserId, overrides);
  return match;
}

export async function adjustUserTrustAndProxy(
  repo: Repository,
  userId: string,
  trustDelta: number,
  proxyXpDelta = 0
): Promise<User> {
  const user = await repo.findUser(userId);
  const updated = applyUserProgress(user, trustDelta, proxyXpDelta);
  await repo.saveUser(updated.user);
  return updated.user;
}

function transitionMatch(match: Match, next: MatchState): void {
  if (!canTransition(match.state, next)) {
    throw new Error(`Invalid match transition: ${match.state} -> ${next}`);
  }
  match.state = next;
  match.updatedAt = now();
}

function hasAnyResultEntry(result?: ResultProof): boolean {
  if (!result) {
    return false;
  }
  if (result.entries && result.entries.length > 0) {
    return true;
  }
  return Boolean(result.userId && result.proofUrl !== undefined && result.value !== undefined);
}

function mergeResultProof(current: ResultProof | undefined, incoming: ResultProof): ResultProof {
  const mergedEntries = new Map<string, ResultEntry>();

  const pushLegacyEntry = (proof: ResultProof | undefined) => {
    if (!proof?.userId || proof.value === undefined || !proof.proofUrl) {
      return;
    }
    mergedEntries.set(proof.userId, {
      userId: proof.userId,
      value: proof.value,
      proofUrl: proof.proofUrl,
      demoUrl: undefined,
      submittedAt: proof.submittedAt
    });
  };

  const pushEntries = (proof: ResultProof | undefined) => {
    proof?.entries?.forEach((entry) => {
      mergedEntries.set(entry.userId, entry);
    });
  };

  pushLegacyEntry(current);
  pushEntries(current);
  pushLegacyEntry(incoming);
  pushEntries(incoming);

  const entries = Array.from(mergedEntries.values());
  return {
    metricType: incoming.metricType ?? current?.metricType ?? "SCORE",
    submittedAt: incoming.submittedAt ?? now(),
    value: incoming.value ?? current?.value,
    proofUrl: incoming.proofUrl ?? current?.proofUrl,
    userId: incoming.userId ?? current?.userId,
    entries,
    winnerUserId: incoming.winnerUserId ?? current?.winnerUserId,
    notes: incoming.notes ?? current?.notes
  };
}

async function ensureAutoDispute(
  repo: Repository,
  match: Match,
  openedBy: string | undefined,
  reason: string
): Promise<void> {
  const disputes = await repo.listDisputesByMatch(match.id);
  const open = disputes.find((item) => item.status === "OPEN");
  if (open) {
    return;
  }
  await repo.createDispute({
    id: createId("dispute"),
    matchId: match.id,
    openedBy: openedBy ?? match.players[0]?.userId ?? "system",
    reason,
    status: "OPEN",
    createdAt: now()
  });
}

async function finalizeMatchResolution(
  repo: Repository,
  match: Match,
  source: "CONFIRMATION" | "MODERATION",
  forcedWinnerUserId?: string,
  overrides?: FinalizeOverrides
): Promise<void> {
  if (match.resolution?.finalizedAt) {
    return;
  }

  const players = match.players.map((player) => player.userId);
  if (players.length !== 2) {
    match.resolution = {
      finalizedAt: now(),
      source
    };
    await repo.saveMatch(match);
    return;
  }

  const [playerA, playerB] = players;
  if (!playerA || !playerB) {
    throw new Error("Match participants are invalid");
  }

  const winnerUserId =
    forcedWinnerUserId ??
    match.evidence.result?.winnerUserId ??
    inferWinnerFromResult(match.evidence.result, playerA, playerB);

  const ratingDelta: Record<string, number> = {};
  if (winnerUserId === playerA || winnerUserId === playerB) {
    const [ratingA, ratingB] = await Promise.all([
      getOrCreateRating(repo, playerA, match.leagueId),
      getOrCreateRating(repo, playerB, match.leagueId)
    ]);

    const scoreA: 0 | 1 = winnerUserId === playerA ? 1 : 0;
    const next = applyEloResult(
      ratingA.elo,
      ratingB.elo,
      scoreA,
      defaultEloConfig,
      ratingA.provisionalMatches,
      ratingB.provisionalMatches
    );

    const nextRatingA: Rating = {
      ...ratingA,
      elo: next.nextRatingA,
      provisionalMatches: ratingA.provisionalMatches + 1,
      updatedAt: now()
    };
    const nextRatingB: Rating = {
      ...ratingB,
      elo: next.nextRatingB,
      provisionalMatches: ratingB.provisionalMatches + 1,
      updatedAt: now()
    };

    await Promise.all([repo.saveRating(nextRatingA), repo.saveRating(nextRatingB)]);
    ratingDelta[playerA] = nextRatingA.elo - ratingA.elo;
    ratingDelta[playerB] = nextRatingB.elo - ratingB.elo;
  }

  const trustDelta: Record<string, number> = {};
  const proxyXpDelta: Record<string, number> = {};
  for (const userId of players) {
    const user = await repo.findUser(userId);
    const won = winnerUserId === userId;
    const trustGain =
      overrides?.trustDelta?.[userId] ?? (source === "CONFIRMATION" ? 2 : won ? 1 : -1);
    const xpGain = overrides?.proxyXpDelta?.[userId] ?? (won ? 45 : 30);
    const updated = applyUserProgress(user, trustGain, xpGain);
    trustDelta[userId] = updated.trustDelta;
    proxyXpDelta[userId] = xpGain;
    await repo.saveUser(updated.user);
  }

  match.evidence.result = {
    ...(match.evidence.result ?? {
      metricType: "SCORE",
      submittedAt: now()
    }),
    winnerUserId: winnerUserId ?? undefined
  };
  match.resolution = {
    finalizedAt: now(),
    source,
    winnerUserId: winnerUserId ?? undefined,
    ratingDelta,
    trustDelta,
    proxyXpDelta
  };
  match.updatedAt = now();
  await repo.saveMatch(match);
}

async function getOrCreateRating(
  repo: Repository,
  userId: string,
  leagueId: string
): Promise<Rating> {
  const existing = await repo.findRating(userId, leagueId);
  if (existing) {
    return existing;
  }
  return {
    userId,
    leagueId,
    elo: 1000,
    provisionalMatches: 0,
    updatedAt: now()
  };
}

function applyUserProgress(user: User, trustGain: number, xpGain: number): { user: User; trustDelta: number } {
  const nextTrust = clamp(user.trustScore + trustGain, 0, 200);
  let level = user.proxyLevel.level;
  let xp = user.proxyLevel.xp + xpGain;
  let nextXp = user.proxyLevel.nextXp;

  while (xp >= nextXp && level < 60) {
    xp -= nextXp;
    level += 1;
    nextXp = Math.max(100, Math.round(nextXp * 1.12));
  }

  return {
    trustDelta: nextTrust - user.trustScore,
    user: {
      ...user,
      trustScore: nextTrust,
      proxyLevel: {
        level,
        xp,
        nextXp
      },
      updatedAt: now()
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function inferWinnerFromResult(
  result: ResultProof | undefined,
  playerA: string,
  playerB: string
): string | undefined {
  if (!result) {
    return undefined;
  }

  const entries: Array<{ userId: string; value: number | string }> = [
    ...(result.entries ?? []).map((entry) => ({ userId: entry.userId, value: entry.value })),
    ...(result.userId && result.value !== undefined
      ? [
          {
            userId: result.userId,
            value: result.value
          }
        ]
      : [])
  ];

  const byUser = new Map<string, number | string>();
  entries.forEach((entry) => {
    byUser.set(entry.userId, entry.value);
  });

  const valueA = byUser.get(playerA);
  const valueB = byUser.get(playerB);
  if (valueA === undefined && valueB === undefined) {
    return entries[0]?.userId;
  }
  if (valueA === undefined) {
    return playerB;
  }
  if (valueB === undefined) {
    return playerA;
  }

  const comparison = compareResultValues(result.metricType, valueA, valueB);
  if (comparison === 0) {
    return undefined;
  }
  return comparison > 0 ? playerA : playerB;
}

function compareResultValues(
  metricType: ChallengeMetricType,
  valueA: number | string,
  valueB: number | string
): number {
  if (metricType === "RANK_TIER") {
    return normalizeRankTier(valueA) - normalizeRankTier(valueB);
  }

  const numA = Number(valueA);
  const numB = Number(valueB);
  if (!Number.isFinite(numA) || !Number.isFinite(numB)) {
    return 0;
  }

  if (metricType === "TIME_MS") {
    if (numA === numB) {
      return 0;
    }
    return numA < numB ? 1 : -1;
  }

  if (numA === numB) {
    return 0;
  }
  return numA > numB ? 1 : -1;
}

function normalizeRankTier(value: number | string): number {
  const normalized = String(value).trim().toUpperCase();
  const map: Record<string, number> = {
    SSS: 7,
    SS: 6,
    S: 5,
    A: 4,
    B: 3,
    C: 2,
    D: 1
  };
  if (normalized in map) {
    return map[normalized] ?? 0;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}
