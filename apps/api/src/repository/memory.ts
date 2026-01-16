import type { Dispute, Match, Rating } from "@ika/shared";
import {
  agents,
  challenges,
  leagues,
  queues,
  ratings,
  rulesets,
  seasons,
  users
} from "../seed";
import type { Repository } from "./types";

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
    disputes: new Map()
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
    async findOpponent(userId: string) {
      return state.users.find((user) => user.id !== userId) ?? null;
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
    async listOpenDisputes() {
      return Array.from(state.disputes.values()).filter((item) => item.status === "OPEN");
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
