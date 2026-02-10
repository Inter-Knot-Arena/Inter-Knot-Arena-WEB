import type { Dispute, Match, MatchState, Rating } from "@ika/shared";
import {
  agents,
  challenges,
  leagues,
  queues,
  ratings,
  rulesets,
  seasons,
  users
} from "../seed.js";
import type { MatchmakingEntry, Repository } from "./types.js";

interface MemoryState {
  agents: typeof agents;
  leagues: typeof leagues;
  rulesets: typeof rulesets;
  challenges: typeof challenges;
  seasons: typeof seasons;
  users: typeof users;
  ratings: typeof ratings;
  queues: typeof queues;
  matches: Map<string, Match>;
  disputes: Map<string, Dispute>;
  matchmakingQueue: Map<string, MatchmakingEntry>;
}

export function createMemoryRepository(): Repository {
  const state: MemoryState = {
    agents,
    leagues,
    rulesets,
    challenges,
    seasons,
    users,
    ratings,
    queues,
    matches: new Map(),
    disputes: new Map(),
    matchmakingQueue: new Map()
  };

  return {
    async listAgents() {
      return state.agents;
    },
    async listLeagues() {
      return state.leagues;
    },
    async listRulesets() {
      return state.rulesets;
    },
    async listChallenges() {
      return state.challenges;
    },
    async listQueues() {
      return state.queues;
    },
    async listUsers() {
      return state.users;
    },
    async listRatingsByUser(userId: string) {
      return state.ratings.filter((item) => item.userId === userId);
    },
    async listLeaderboard(leagueId: string) {
      return sortRatings(state.ratings, leagueId);
    },
    async findRating(userId: string, leagueId: string) {
      return (
        state.ratings.find((item) => item.userId === userId && item.leagueId === leagueId) ?? null
      );
    },
    async saveRating(rating: Rating) {
      const index = state.ratings.findIndex(
        (item) => item.userId === rating.userId && item.leagueId === rating.leagueId
      );
      if (index === -1) {
        state.ratings.push(rating);
      } else {
        state.ratings[index] = rating;
      }
      return rating;
    },
    async listMatchesByStates(states: MatchState[]) {
      return Array.from(state.matches.values()).filter((match) => states.includes(match.state));
    },
    async getActiveSeason() {
      const season = state.seasons.find((item) => item.status === "ACTIVE");
      if (!season) {
        throw new Error("No active season configured");
      }
      return season;
    },
    async findRuleset(rulesetId: string) {
      const ruleset = state.rulesets.find((item) => item.id === rulesetId);
      if (!ruleset) {
        throw new Error("Ruleset not found");
      }
      return ruleset;
    },
    async findQueue(queueId: string) {
      const queue = state.queues.find((item) => item.id === queueId);
      if (!queue) {
        throw new Error("Queue not found");
      }
      return queue;
    },
    async findUser(userId: string) {
      const user = state.users.find((item) => item.id === userId);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    },
    async findUserByEmail(email: string) {
      return state.users.find((item) => item.email === email) ?? null;
    },
    async findOpponent(userId: string) {
      return state.users.find((user) => user.id !== userId) ?? null;
    },
    async createUser(user) {
      state.users.push(user);
      return user;
    },
    async saveUser(user) {
      const index = state.users.findIndex((item) => item.id === user.id);
      if (index === -1) {
        state.users.push(user);
      } else {
        state.users[index] = user;
      }
      return user;
    },
    async findMatch(matchId: string) {
      const match = state.matches.get(matchId);
      if (!match) {
        throw new Error("Match not found");
      }
      return match;
    },
    async createMatch(match: Match) {
      state.matches.set(match.id, match);
      return match;
    },
    async saveMatch(match: Match) {
      state.matches.set(match.id, match);
      return match;
    },
    async listMatchmakingEntries() {
      return Array.from(state.matchmakingQueue.values());
    },
    async findMatchmakingEntry(entryId: string) {
      const entry = state.matchmakingQueue.get(entryId);
      if (!entry) {
        throw new Error("Matchmaking ticket not found");
      }
      return entry;
    },
    async findMatchmakingEntryByUser(queueId: string, userId: string) {
      return (
        Array.from(state.matchmakingQueue.values()).find(
          (entry) => entry.queueId === queueId && entry.userId === userId
        ) ?? null
      );
    },
    async findWaitingMatchmakingEntry(queueId: string, excludeUserId: string) {
      return (
        Array.from(state.matchmakingQueue.values()).find(
          (entry) =>
            entry.queueId === queueId &&
            entry.userId !== excludeUserId &&
            entry.status === "WAITING"
        ) ?? null
      );
    },
    async createMatchmakingEntry(entry: MatchmakingEntry) {
      state.matchmakingQueue.set(entry.id, entry);
      return entry;
    },
    async saveMatchmakingEntry(entry: MatchmakingEntry) {
      state.matchmakingQueue.set(entry.id, entry);
      return entry;
    },
    async deleteMatchmakingEntry(entryId: string) {
      state.matchmakingQueue.delete(entryId);
    },
    async listOpenDisputes() {
      return Array.from(state.disputes.values()).filter((item) => item.status === "OPEN");
    },
    async listDisputesByMatch(matchId: string) {
      return Array.from(state.disputes.values()).filter((item) => item.matchId === matchId);
    },
    async findDispute(disputeId: string) {
      const dispute = state.disputes.get(disputeId);
      if (!dispute) {
        throw new Error("Dispute not found");
      }
      return dispute;
    },
    async createDispute(dispute: Dispute) {
      state.disputes.set(dispute.id, dispute);
      return dispute;
    },
    async saveDispute(dispute: Dispute) {
      state.disputes.set(dispute.id, dispute);
      return dispute;
    }
  };
}

function sortRatings(source: Rating[], leagueId: string): Rating[] {
  return source
    .filter((item) => item.leagueId === leagueId)
    .slice()
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 100);
}
