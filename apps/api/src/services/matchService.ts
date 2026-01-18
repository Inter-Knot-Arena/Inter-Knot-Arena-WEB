import type { Dispute, DraftAction, EvidenceRecord, Match, MatchState, ResultProof } from "@ika/shared";
import {
  canTransition,
  getDraftTemplate,
  isDraftComplete,
  listDraftAgents,
  nextDraftAction
} from "@ika/shared";
import type { Repository } from "../repository/types.js";
import { createId, now } from "../utils.js";

export async function createMatchFromQueue(
  repo: Repository,
  queueId: string,
  userId: string,
  opponentUserId?: string
): Promise<Match> {
  const queue = await repo.findQueue(queueId);
  const season = await repo.getActiveSeason();
  const template = getDraftTemplate("bo1-standard");
  const opponent = opponentUserId
    ? await repo.findUser(opponentUserId)
    : (await repo.findOpponent(userId)) ?? (await repo.findUser(userId));

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
    transitionMatch(match, "AWAITING_PRECHECK");
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
  match.evidence.precheck.push(record);
  match.updatedAt = now();

  const passCount = match.evidence.precheck.filter((item) => item.result === "PASS").length;
  if (match.state === "AWAITING_PRECHECK" && passCount >= 2) {
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
  match.evidence.inrun.push(record);
  match.updatedAt = now();
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
  if (match.state === "READY_TO_START") {
    transitionMatch(match, "IN_PROGRESS");
  }
  if (match.state === "IN_PROGRESS") {
    transitionMatch(match, "AWAITING_RESULT_UPLOAD");
  }
  match.evidence.result = result ?? undefined;
  match.updatedAt = now();
  if (match.state === "AWAITING_RESULT_UPLOAD") {
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
  }

  await repo.saveMatch(match);
  return match;
}

export async function openDispute(
  repo: Repository,
  matchId: string,
  userId: string,
  reason: string
): Promise<Dispute> {
  const match = await repo.findMatch(matchId);
  const dispute: Dispute = {
    id: createId("dispute"),
    matchId: match.id,
    openedBy: userId,
    reason,
    status: "OPEN",
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
  decision: string
): Promise<Dispute> {
  const dispute = await repo.findDispute(disputeId);
  dispute.status = "RESOLVED";
  dispute.decision = decision;
  dispute.resolvedAt = now();

  await repo.saveDispute(dispute);

  const match = await repo.findMatch(dispute.matchId);
  if (match.state === "DISPUTED") {
    transitionMatch(match, "RESOLVED");
    await repo.saveMatch(match);
  }

  return dispute;
}

function transitionMatch(match: Match, next: MatchState): void {
  if (!canTransition(match.state, next)) {
    throw new Error(`Invalid match transition: ${match.state} -> ${next}`);
  }
  match.state = next;
  match.updatedAt = now();
}
