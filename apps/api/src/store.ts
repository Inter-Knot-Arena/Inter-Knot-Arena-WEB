import type {
  Challenge,
  Dispute,
  DraftAction,
  League,
  Match,
  MatchState,
  QueueConfig,
  Rating,
  Ruleset,
  Season,
  User
} from "@ika/shared";
import {
  canTransition,
  getDraftTemplate,
  isDraftComplete,
  listDraftAgents,
  nextDraftAction
} from "@ika/shared";
import { agents, challenges, leagues, queues, ratings, rulesets, seasons, users } from "./seed";
import { createId, now } from "./utils";

export interface Store {
  agents: typeof agents;
  leagues: League[];
  rulesets: Ruleset[];
  challenges: Challenge[];
  seasons: Season[];
  users: User[];
  ratings: Rating[];
  queues: QueueConfig[];
  matches: Map<string, Match>;
  disputes: Map<string, Dispute>;
}

export const store: Store = createStore();

function createStore(): Store {
  return {
    agents,
    leagues,
    rulesets,
    challenges,
    seasons,
    users,
    ratings,
    queues,
    matches: new Map(),
    disputes: new Map()
  };
}

export function getActiveSeason(): Season {
  const season = store.seasons.find((item) => item.status === "ACTIVE");
  if (!season) {
    throw new Error("No active season configured");
  }
  return season;
}

export function findQueue(queueId: string): QueueConfig {
  const queue = store.queues.find((item) => item.id === queueId);
  if (!queue) {
    throw new Error("Queue not found");
  }
  return queue;
}

export function findRuleset(rulesetId: string): Ruleset {
  const ruleset = store.rulesets.find((item) => item.id === rulesetId);
  if (!ruleset) {
    throw new Error("Ruleset not found");
  }
  return ruleset;
}

export function findMatch(matchId: string): Match {
  const match = store.matches.get(matchId);
  if (!match) {
    throw new Error("Match not found");
  }
  return match;
}

export function createMatchFromQueue(queueId: string, userId: string): Match {
  const queue = findQueue(queueId);
  const season = getActiveSeason();
  const template = getDraftTemplate("bo1-standard");

  const opponent = store.users.find((user) => user.id !== userId) ?? store.users[0];
  if (!opponent) {
    throw new Error("No opponent available");
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

  store.matches.set(match.id, match);
  return match;
}

export function transitionMatch(match: Match, next: MatchState): void {
  if (!canTransition(match.state, next)) {
    throw new Error(`Invalid match transition: ${match.state} -> ${next}`);
  }
  match.state = next;
  match.updatedAt = now();
}

export function markCheckin(match: Match, userId: string): void {
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
}

export function applyDraftAction(match: Match, action: DraftAction): void {
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

  const ruleset = findRuleset(match.rulesetId);
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
    transitionMatch(match, "AWAITING_PRECHECK");
  }
}

export function recordPrecheck(match: Match, record: Match["evidence"]["precheck"][number]): void {
  match.evidence.precheck.push(record);
  match.updatedAt = now();

  const passCount = match.evidence.precheck.filter((item) => item.result === "PASS").length;
  if (match.state === "AWAITING_PRECHECK" && passCount >= 2) {
    transitionMatch(match, "READY_TO_START");
  }
}

export function recordInrun(match: Match, record: Match["evidence"]["inrun"][number]): void {
  match.evidence.inrun.push(record);
  match.updatedAt = now();
}

export function recordResult(match: Match, result: Match["evidence"]["result"]): void {
  match.evidence.result = result ?? undefined;
  match.updatedAt = now();
  if (match.state === "AWAITING_RESULT_UPLOAD") {
    transitionMatch(match, "AWAITING_CONFIRMATION");
  }
}

export function confirmMatch(match: Match, userId: string): void {
  if (!match.confirmedBy.includes(userId)) {
    match.confirmedBy.push(userId);
  }
  match.updatedAt = now();

  if (
    match.state === "AWAITING_CONFIRMATION" &&
    match.confirmedBy.length >= match.players.length
  ) {
    transitionMatch(match, "RESOLVED");
  }
}

export function openDispute(match: Match, userId: string, reason: string): Dispute {
  const dispute: Dispute = {
    id: createId("dispute"),
    matchId: match.id,
    openedBy: userId,
    reason,
    status: "OPEN",
    createdAt: now()
  };
  store.disputes.set(dispute.id, dispute);
  if (match.state !== "DISPUTED") {
    transitionMatch(match, "DISPUTED");
  }
  return dispute;
}

export function resolveDispute(disputeId: string, decision: string): Dispute {
  const dispute = store.disputes.get(disputeId);
  if (!dispute) {
    throw new Error("Dispute not found");
  }
  dispute.status = "RESOLVED";
  dispute.decision = decision;
  dispute.resolvedAt = now();

  const match = store.matches.get(dispute.matchId);
  if (match && match.state === "DISPUTED") {
    transitionMatch(match, "RESOLVED");
  }

  return dispute;
}

export function listLeaderboard(leagueId: string): Rating[] {
  return store.ratings
    .filter((item) => item.leagueId === leagueId)
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 100);
}
