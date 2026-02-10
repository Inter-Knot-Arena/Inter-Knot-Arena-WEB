import type { Match, MatchState } from "@ika/shared";
import type { MatchmakingEntry, Repository } from "../repository/types.js";
import { createId, now } from "../utils.js";
import { createMatchFromQueue } from "./matchService.js";

export interface MatchmakingSearchResponse {
  status: "SEARCHING" | "MATCH_FOUND";
  ticketId: string;
  match?: Match;
}

export interface MatchmakingStatusResponse {
  status: "SEARCHING" | "MATCH_FOUND";
  match?: Match;
}

export interface MatchmakingCancelResponse {
  status: "CANCELED" | "MATCH_FOUND";
  match?: Match;
}

export interface LobbyStats {
  leagueId: string;
  waiting: number;
  inProgress: number;
}

const ACTIVE_MATCH_STATES: MatchState[] = [
  "CHECKIN",
  "DRAFTING",
  "AWAITING_PRECHECK",
  "READY_TO_START",
  "IN_PROGRESS",
  "AWAITING_RESULT_UPLOAD",
  "AWAITING_CONFIRMATION",
  "DISPUTED"
];

export async function searchMatch(
  repo: Repository,
  queueId: string,
  userId: string
): Promise<MatchmakingSearchResponse> {
  await ensureQueueAccess(repo, queueId, userId);
  const existing = await repo.findMatchmakingEntryByUser(queueId, userId);
  if (existing) {
    if (existing.status === "MATCH_FOUND" && existing.matchId) {
      const match = await repo.findMatch(existing.matchId);
      return { status: "MATCH_FOUND", ticketId: existing.id, match };
    }
    return { status: "SEARCHING", ticketId: existing.id };
  }

  const opponent = await repo.findWaitingMatchmakingEntry(queueId, userId);
  if (opponent) {
    const match = await createMatchFromQueue(repo, queueId, userId, opponent.userId);
    const updatedOpponent: MatchmakingEntry = {
      ...opponent,
      status: "MATCH_FOUND",
      matchId: match.id,
      updatedAt: now()
    };
    await repo.saveMatchmakingEntry(updatedOpponent);

    const ticket = buildTicket(queueId, userId, "MATCH_FOUND", match.id);
    await repo.createMatchmakingEntry(ticket);
    return { status: "MATCH_FOUND", ticketId: ticket.id, match };
  }

  const ticket = buildTicket(queueId, userId, "WAITING");
  await repo.createMatchmakingEntry(ticket);
  return { status: "SEARCHING", ticketId: ticket.id };
}

export async function getMatchmakingStatus(
  repo: Repository,
  ticketId: string
): Promise<MatchmakingStatusResponse> {
  const entry = await repo.findMatchmakingEntry(ticketId);
  if (entry.status === "MATCH_FOUND" && entry.matchId) {
    const match = await repo.findMatch(entry.matchId);
    await repo.deleteMatchmakingEntry(entry.id);
    return { status: "MATCH_FOUND", match };
  }
  return { status: "SEARCHING" };
}

export async function cancelMatchmaking(
  repo: Repository,
  ticketId: string
): Promise<MatchmakingCancelResponse> {
  const entry = await repo.findMatchmakingEntry(ticketId);
  if (entry.status === "MATCH_FOUND" && entry.matchId) {
    const match = await repo.findMatch(entry.matchId);
    await repo.deleteMatchmakingEntry(entry.id);
    return { status: "MATCH_FOUND", match };
  }
  await repo.deleteMatchmakingEntry(entry.id);
  return { status: "CANCELED" };
}

export async function getLobbyStats(repo: Repository): Promise<LobbyStats[]> {
  const [leagues, queues, entries, matches] = await Promise.all([
    repo.listLeagues(),
    repo.listQueues(),
    repo.listMatchmakingEntries(),
    repo.listMatchesByStates(ACTIVE_MATCH_STATES)
  ]);

  const queueLeagueMap = new Map(queues.map((queue) => [queue.id, queue.leagueId]));
  const waitingCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status !== "WAITING") {
      continue;
    }
    const leagueId = queueLeagueMap.get(entry.queueId);
    if (!leagueId) {
      continue;
    }
    waitingCounts.set(leagueId, (waitingCounts.get(leagueId) ?? 0) + 1);
  }

  const inProgressCounts = new Map<string, number>();
  for (const match of matches) {
    inProgressCounts.set(match.leagueId, (inProgressCounts.get(match.leagueId) ?? 0) + 1);
  }

  return leagues.map((league) => ({
    leagueId: league.id,
    waiting: waitingCounts.get(league.id) ?? 0,
    inProgress: inProgressCounts.get(league.id) ?? 0
  }));
}

function buildTicket(
  queueId: string,
  userId: string,
  status: MatchmakingEntry["status"],
  matchId?: string
): MatchmakingEntry {
  const timestamp = now();
  return {
    id: createId("ticket"),
    queueId,
    userId,
    status,
    matchId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function ensureQueueAccess(repo: Repository, queueId: string, userId: string): Promise<void> {
  const [queue, user] = await Promise.all([repo.findQueue(queueId), repo.findUser(userId)]);
  if (queue.requireVerifier && user.verification.status !== "VERIFIED") {
    throw new Error("This queue requires UID-verified account.");
  }
}
