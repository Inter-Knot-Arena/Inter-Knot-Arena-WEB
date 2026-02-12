import type { DraftAction, Match, Ruleset } from "@ika/shared";
import { canTransition, getDraftTemplate, isDraftComplete } from "@ika/shared";
import type { Repository } from "../repository/types.js";
import { createId, now } from "../utils.js";
import {
  adjustUserTrustAndProxy,
  forceResolveMatch,
  inferWinnerFromResult
} from "./matchService.js";

const ACTIVE_STATES: Match["state"][] = [
  "CHECKIN",
  "DRAFTING",
  "AWAITING_PRECHECK",
  "AWAITING_CONFIRMATION"
];
const RETENTION_SWEEP_INTERVAL_MS = Number(process.env.EVIDENCE_RETENTION_SWEEP_MS ?? 60 * 60 * 1000);
let lastRetentionSweepAt = 0;

export interface MatchLifecycleConfig {
  checkinTimeoutMs: number;
  draftActionTimeoutMs: number;
  precheckTimeoutMs: number;
  confirmationTimeoutMs: number;
}

export function readMatchLifecycleConfig(): MatchLifecycleConfig {
  return {
    checkinTimeoutMs: Number(process.env.MATCH_CHECKIN_TIMEOUT_MS ?? 3 * 60 * 1000),
    draftActionTimeoutMs: Number(process.env.MATCH_DRAFT_ACTION_TIMEOUT_MS ?? 30 * 1000),
    precheckTimeoutMs: Number(process.env.MATCH_PRECHECK_TIMEOUT_MS ?? 2 * 60 * 1000),
    confirmationTimeoutMs: Number(process.env.MATCH_CONFIRMATION_TIMEOUT_MS ?? 24 * 60 * 60 * 1000)
  };
}

export async function runMatchLifecycle(
  repo: Repository,
  config: MatchLifecycleConfig,
  timestamp = now()
): Promise<void> {
  const matches = await repo.listMatchesByStates(ACTIVE_STATES);
  if (!matches.length) {
    return;
  }

  const agents = await repo.listAgents();
  const allAgentIds = agents.map((agent) => agent.id);
  const resolvedMatches = await repo.listMatchesByStates(["RESOLVED"]);
  const agentPriority = buildAgentPriority(resolvedMatches, allAgentIds);

  for (const match of matches) {
    if (match.state === "CHECKIN") {
      await processCheckinTimeout(repo, match, config, timestamp);
      continue;
    }
    if (match.state === "DRAFTING") {
      await processDraftTimeout(repo, match, config, timestamp, allAgentIds, agentPriority);
      continue;
    }
    if (match.state === "AWAITING_PRECHECK") {
      await processPrecheckTimeout(repo, match, config, timestamp);
      continue;
    }
    if (match.state === "AWAITING_CONFIRMATION") {
      await processConfirmationTimeout(repo, match, config, timestamp);
    }
  }

  if (timestamp - lastRetentionSweepAt >= RETENTION_SWEEP_INTERVAL_MS) {
    await runEvidenceRetentionSweep(repo, timestamp);
    lastRetentionSweepAt = timestamp;
  }
}

async function processCheckinTimeout(
  repo: Repository,
  match: Match,
  config: MatchLifecycleConfig,
  timestamp: number
): Promise<void> {
  if (timestamp - match.createdAt < config.checkinTimeoutMs) {
    return;
  }

  const checkedIn = match.players.filter((player) => player.checkin);
  if (checkedIn.length === 1) {
    const winnerUserId = checkedIn[0]?.userId;
    const loserUserId = match.players.find((player) => player.userId !== winnerUserId)?.userId;
    if (!winnerUserId || !loserUserId) {
      return;
    }
    await forceResolveMatch(repo, match.id, winnerUserId, {
      trustDelta: {
        [winnerUserId]: 1,
        [loserUserId]: -6
      },
      proxyXpDelta: {
        [winnerUserId]: 15,
        [loserUserId]: 0
      }
    });
    return;
  }

  if (!canTransition(match.state, "EXPIRED")) {
    return;
  }
  match.state = "EXPIRED";
  match.updatedAt = timestamp;
  await repo.saveMatch(match);
  await Promise.all(
    match.players.map((player) => adjustUserTrustAndProxy(repo, player.userId, -3, 0))
  );
}

async function processDraftTimeout(
  repo: Repository,
  match: Match,
  config: MatchLifecycleConfig,
  timestamp: number,
  allAgentIds: string[],
  agentPriority: string[]
): Promise<void> {
  const latestActionAt =
    match.draft.actions[match.draft.actions.length - 1]?.timestamp ?? match.updatedAt;
  if (timestamp - latestActionAt < config.draftActionTimeoutMs) {
    return;
  }

  const template = getDraftTemplate(match.draft.templateId);
  const nextActionType = template.sequence[match.draft.actions.length];
  if (!nextActionType) {
    return;
  }

  const actionSide = nextActionType.endsWith("_A") ? "A" : "B";
  const actionPlayer = match.players.find((player) => player.side === actionSide);
  if (!actionPlayer) {
    return;
  }

  const ruleset = await repo.findRuleset(match.rulesetId);
  const candidateAgentId = chooseAutoDraftAgent(match, ruleset, allAgentIds, agentPriority);
  if (!candidateAgentId) {
    if (canTransition(match.state, "DISPUTED")) {
      match.state = "DISPUTED";
      match.updatedAt = timestamp;
      await repo.saveMatch(match);
      await openSystemDisputeIfNeeded(
        repo,
        match.id,
        "Draft timeout could not auto-assign an agent.",
        match.players[0]?.userId
      );
    }
    return;
  }

  const autoAction: DraftAction = {
    type: nextActionType,
    agentId: candidateAgentId,
    userId: actionPlayer.userId,
    timestamp
  };
  match.draft.actions.push(autoAction);
  match.updatedAt = timestamp;

  if (isDraftComplete(template, match.draft.actions)) {
    if (ruleset.evidencePolicy.precheckRequired && canTransition(match.state, "AWAITING_PRECHECK")) {
      match.state = "AWAITING_PRECHECK";
    } else if (canTransition(match.state, "READY_TO_START")) {
      match.state = "READY_TO_START";
    }
  }

  await repo.saveMatch(match);
  const trustPenalty = nextActionType.startsWith("PICK") ? -2 : -1;
  await adjustUserTrustAndProxy(repo, actionPlayer.userId, trustPenalty, 0);
}

async function processPrecheckTimeout(
  repo: Repository,
  match: Match,
  config: MatchLifecycleConfig,
  timestamp: number
): Promise<void> {
  if (timestamp - match.updatedAt < config.precheckTimeoutMs) {
    return;
  }

  const passedUsers = new Set(
    match.evidence.precheck
      .filter((record) => record.result === "PASS" && record.userId)
      .map((record) => record.userId as string)
  );

  if (passedUsers.size === 1) {
    const winnerUserId = Array.from(passedUsers)[0];
    const loserUserId = match.players.find((player) => player.userId !== winnerUserId)?.userId;
    if (!winnerUserId || !loserUserId) {
      return;
    }
    await forceResolveMatch(repo, match.id, winnerUserId, {
      trustDelta: {
        [winnerUserId]: 1,
        [loserUserId]: -5
      },
      proxyXpDelta: {
        [winnerUserId]: 20,
        [loserUserId]: 0
      }
    });
    return;
  }

  if (!canTransition(match.state, "EXPIRED")) {
    return;
  }
  match.state = "EXPIRED";
  match.updatedAt = timestamp;
  await repo.saveMatch(match);
  await Promise.all(
    match.players.map((player) => adjustUserTrustAndProxy(repo, player.userId, -2, 0))
  );
}

async function processConfirmationTimeout(
  repo: Repository,
  match: Match,
  config: MatchLifecycleConfig,
  timestamp: number
): Promise<void> {
  if (timestamp - match.updatedAt < config.confirmationTimeoutMs) {
    return;
  }

  const [playerA, playerB] = match.players.map((player) => player.userId);
  if (!playerA || !playerB) {
    return;
  }
  const winner = inferWinnerFromResult(match.evidence.result, playerA, playerB);
  if (winner) {
    const loser = winner === playerA ? playerB : playerA;
    await forceResolveMatch(repo, match.id, winner, {
      trustDelta: {
        [winner]: 1,
        [loser]: -2
      }
    });
    return;
  }

  if (canTransition(match.state, "DISPUTED")) {
    match.state = "DISPUTED";
    match.updatedAt = timestamp;
    await repo.saveMatch(match);
    await openSystemDisputeIfNeeded(
      repo,
      match.id,
      "Confirmation timeout reached without a clear winner.",
      match.players[0]?.userId
    );
  }
}

function chooseAutoDraftAgent(
  match: Match,
  ruleset: Ruleset,
  allAgentIds: string[],
  agentPriority: string[]
): string | null {
  const taken = new Set(match.draft.actions.map((action) => action.agentId));
  const order = agentPriority.length > 0 ? agentPriority : allAgentIds;

  return (
    order.find((agentId) => {
      if (taken.has(agentId)) {
        return false;
      }
      if (!ruleset.allowedAgents) {
        return true;
      }
      const listed = ruleset.allowedAgents.agentIds.includes(agentId);
      if (ruleset.allowedAgents.mode === "WHITELIST") {
        return listed;
      }
      if (ruleset.allowedAgents.mode === "BLACKLIST") {
        return !listed;
      }
      return true;
    }) ?? null
  );
}

function buildAgentPriority(resolvedMatches: Match[], allAgentIds: string[]): string[] {
  const stats = new Map<string, { picks: number; bans: number; wins: number; losses: number }>();
  const ensure = (agentId: string) => {
    const existing = stats.get(agentId);
    if (existing) {
      return existing;
    }
    const fresh = { picks: 0, bans: 0, wins: 0, losses: 0 };
    stats.set(agentId, fresh);
    return fresh;
  };

  resolvedMatches.forEach((match) => {
    const winner = match.resolution?.winnerUserId ?? match.evidence.result?.winnerUserId;
    match.draft.actions.forEach((action) => {
      const row = ensure(action.agentId);
      if (action.type.startsWith("BAN")) {
        row.bans += 1;
      }
      if (action.type.startsWith("PICK")) {
        row.picks += 1;
        if (!winner) {
          return;
        }
        if (action.userId === winner) {
          row.wins += 1;
        } else {
          row.losses += 1;
        }
      }
    });
  });

  return allAgentIds
    .slice()
    .sort((a, b) => {
      const sa = stats.get(a) ?? { picks: 0, bans: 0, wins: 0, losses: 0 };
      const sb = stats.get(b) ?? { picks: 0, bans: 0, wins: 0, losses: 0 };
      const activityA = sa.picks + sa.bans;
      const activityB = sb.picks + sb.bans;
      if (activityA !== activityB) {
        return activityB - activityA;
      }
      const wrA = sa.wins + sa.losses > 0 ? sa.wins / (sa.wins + sa.losses) : 0;
      const wrB = sb.wins + sb.losses > 0 ? sb.wins / (sb.wins + sb.losses) : 0;
      return wrB - wrA;
    });
}

async function openSystemDisputeIfNeeded(
  repo: Repository,
  matchId: string,
  reason: string,
  openedByUserId?: string
): Promise<void> {
  const existing = await repo.listDisputesByMatch(matchId);
  if (existing.some((dispute) => dispute.status === "OPEN")) {
    return;
  }
  const fallbackOpener =
    openedByUserId ?? (await repo.listUsers())[0]?.id ?? "user_ellen";
  await repo.createDispute({
    id: createId("dispute"),
    matchId,
    openedBy: fallbackOpener,
    reason,
    status: "OPEN",
    createdAt: now()
  });
}

async function runEvidenceRetentionSweep(repo: Repository, timestamp: number): Promise<void> {
  const terminalStates: Match["state"][] = ["RESOLVED", "CANCELED", "EXPIRED"];
  const matches = await repo.listMatchesByStates(terminalStates);
  if (!matches.length) {
    return;
  }

  const rulesetCache = new Map<string, Ruleset>();

  for (const match of matches) {
    const ruleset = await getRulesetCached(repo, rulesetCache, match.rulesetId);
    let changed = false;

    const precheckMaxAgeMs = ruleset.evidencePolicy.retentionDays.precheck * 24 * 60 * 60 * 1000;
    const inrunMaxAgeMs = ruleset.evidencePolicy.retentionDays.inrun * 24 * 60 * 60 * 1000;
    const resultMaxAgeMs = ruleset.evidencePolicy.retentionDays.result * 24 * 60 * 60 * 1000;

    const nextPrecheck = match.evidence.precheck.filter(
      (record) => timestamp - record.timestamp <= precheckMaxAgeMs
    );
    const nextInrun = match.evidence.inrun.filter(
      (record) => timestamp - record.timestamp <= inrunMaxAgeMs
    );

    if (nextPrecheck.length !== match.evidence.precheck.length) {
      match.evidence.precheck = nextPrecheck;
      changed = true;
    }
    if (nextInrun.length !== match.evidence.inrun.length) {
      match.evidence.inrun = nextInrun;
      changed = true;
    }

    const result = match.evidence.result;
    if (result && timestamp - result.submittedAt > resultMaxAgeMs) {
      match.evidence.result = {
        ...result,
        proofUrl: result.proofUrl ? "[redacted]" : undefined,
        entries: result.entries?.map((entry) => ({
          ...entry,
          proofUrl: "[redacted]",
          demoUrl: entry.demoUrl ? "[redacted]" : undefined
        }))
      };
      changed = true;
    }

    if (!changed) {
      continue;
    }
    match.updatedAt = timestamp;
    await repo.saveMatch(match);
  }
}

async function getRulesetCached(
  repo: Repository,
  cache: Map<string, Ruleset>,
  rulesetId: string
): Promise<Ruleset> {
  const existing = cache.get(rulesetId);
  if (existing) {
    return existing;
  }
  const resolved = await repo.findRuleset(rulesetId);
  cache.set(rulesetId, resolved);
  return resolved;
}
