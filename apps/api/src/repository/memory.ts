import type { Dispute, Match, MatchState, Rating, Session } from "@ika/shared";
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
import type {
  MatchmakingEntry,
  OAuthAccountRecord,
  PasswordAccountRecord,
  Repository,
  VerifierDeviceRequest,
  VerifierTokenRecord
} from "./types.js";

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
  oauthAccounts: Map<string, OAuthAccountRecord>;
  passwordAccountsByEmail: Map<string, PasswordAccountRecord>;
  sessions: Map<string, Session>;
  verifierDeviceRequests: Map<string, VerifierDeviceRequest>;
  verifierTokensByValue: Map<string, VerifierTokenRecord>;
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
    matchmakingQueue: new Map(),
    oauthAccounts: new Map(),
    passwordAccountsByEmail: new Map(),
    sessions: new Map(),
    verifierDeviceRequests: new Map(),
    verifierTokensByValue: new Map()
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
    async listSeasons() {
      return state.seasons;
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
    async listMatchesByUser(userId: string) {
      return Array.from(state.matches.values())
        .filter((match) => match.players.some((player) => player.userId === userId))
        .sort((a, b) => b.updatedAt - a.updatedAt);
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
    async saveRuleset(ruleset) {
      const index = state.rulesets.findIndex((item) => item.id === ruleset.id);
      if (index === -1) {
        state.rulesets.push(ruleset);
      } else {
        state.rulesets[index] = ruleset;
      }
      return ruleset;
    },
    async saveSeason(season) {
      const index = state.seasons.findIndex((item) => item.id === season.id);
      if (index === -1) {
        state.seasons.push(season);
      } else {
        state.seasons[index] = season;
      }
      return season;
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
    async listDisputesByMatchIds(matchIds: string[]) {
      if (!matchIds.length) {
        return [];
      }
      const keys = new Set(matchIds);
      return Array.from(state.disputes.values())
        .filter((item) => keys.has(item.matchId))
        .sort((a, b) => a.createdAt - b.createdAt);
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
    },
    async findOAuthAccount(provider, providerAccountId) {
      return state.oauthAccounts.get(`${provider}:${providerAccountId}`) ?? null;
    },
    async findOAuthAccountByEmail(email) {
      for (const account of state.oauthAccounts.values()) {
        if (account.email === email) {
          return account;
        }
      }
      return null;
    },
    async saveOAuthAccount(account) {
      state.oauthAccounts.set(`${account.provider}:${account.providerAccountId}`, account);
      return account;
    },
    async deleteOAuthAccountsByUserId(userId) {
      let removed = 0;
      for (const [key, account] of state.oauthAccounts.entries()) {
        if (account.userId === userId) {
          state.oauthAccounts.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
    async findPasswordAccountByEmail(email) {
      return state.passwordAccountsByEmail.get(email.toLowerCase()) ?? null;
    },
    async findPasswordAccountByUserId(userId) {
      for (const account of state.passwordAccountsByEmail.values()) {
        if (account.userId === userId) {
          return account;
        }
      }
      return null;
    },
    async savePasswordAccount(account) {
      const normalizedEmail = account.email.toLowerCase();
      const payload = { ...account, email: normalizedEmail };
      state.passwordAccountsByEmail.set(normalizedEmail, payload);
      return payload;
    },
    async deletePasswordAccountsByUserId(userId) {
      let removed = 0;
      for (const [email, account] of state.passwordAccountsByEmail.entries()) {
        if (account.userId === userId) {
          state.passwordAccountsByEmail.delete(email);
          removed += 1;
        }
      }
      return removed;
    },
    async createSession(session) {
      state.sessions.set(session.id, session);
      return session;
    },
    async findSession(sessionId) {
      return state.sessions.get(sessionId) ?? null;
    },
    async deleteSession(sessionId) {
      state.sessions.delete(sessionId);
    },
    async deleteSessionsByUserId(userId) {
      let removed = 0;
      for (const [sessionId, session] of state.sessions.entries()) {
        if (session.userId === userId) {
          state.sessions.delete(sessionId);
          removed += 1;
        }
      }
      return removed;
    },
    async purgeExpiredSessions(nowTimestamp) {
      for (const [sessionId, session] of state.sessions.entries()) {
        if (session.expiresAt <= nowTimestamp) {
          state.sessions.delete(sessionId);
        }
      }
    },
    async createVerifierDeviceRequest(request) {
      state.verifierDeviceRequests.set(request.id, request);
      return request;
    },
    async findVerifierDeviceRequest(requestId) {
      return state.verifierDeviceRequests.get(requestId) ?? null;
    },
    async saveVerifierDeviceRequest(request) {
      state.verifierDeviceRequests.set(request.id, request);
      return request;
    },
    async consumeVerifierDeviceCode(requestId, exchangeCode) {
      const request = state.verifierDeviceRequests.get(requestId);
      if (!request) {
        return null;
      }
      if (request.exchangeCode !== exchangeCode || request.status !== "AUTHORIZED") {
        return null;
      }
      if (request.expiresAt <= Date.now()) {
        return null;
      }
      const consumed: VerifierDeviceRequest = {
        ...request,
        status: "CONSUMED",
        consumedAt: Date.now()
      };
      state.verifierDeviceRequests.set(requestId, consumed);
      return consumed;
    },
    async createVerifierToken(token) {
      state.verifierTokensByValue.set(token.token, token);
      return token;
    },
    async findVerifierToken(token, kind) {
      const record = state.verifierTokensByValue.get(token);
      if (!record) {
        return null;
      }
      if (kind && record.kind !== kind) {
        return null;
      }
      if (record.revokedAt) {
        return null;
      }
      if (record.expiresAt <= Date.now()) {
        return null;
      }
      return record;
    },
    async rotateVerifierToken(args) {
      const current = state.verifierTokensByValue.get(args.refreshToken);
      if (!current || current.kind !== "REFRESH") {
        return null;
      }
      if (current.revokedAt || current.expiresAt <= args.rotatedAt) {
        return null;
      }
      state.verifierTokensByValue.set(current.token, {
        ...current,
        revokedAt: args.rotatedAt
      });
      const accessToken: VerifierTokenRecord = {
        ...args.nextAccessToken,
        rotatedFromTokenId: current.id
      };
      const refreshToken: VerifierTokenRecord = {
        ...args.nextRefreshToken,
        rotatedFromTokenId: current.id
      };
      state.verifierTokensByValue.set(accessToken.token, accessToken);
      state.verifierTokensByValue.set(refreshToken.token, refreshToken);
      return { accessToken, refreshToken };
    },
    async revokeVerifierToken(token, revokedAt) {
      const record = state.verifierTokensByValue.get(token);
      if (!record || record.revokedAt) {
        return false;
      }
      state.verifierTokensByValue.set(token, {
        ...record,
        revokedAt
      });
      return true;
    },
    async purgeExpiredVerifierAuth(nowTimestamp) {
      for (const [requestId, request] of state.verifierDeviceRequests.entries()) {
        if (request.expiresAt <= nowTimestamp) {
          state.verifierDeviceRequests.delete(requestId);
        }
      }
      for (const [tokenValue, token] of state.verifierTokensByValue.entries()) {
        if (token.expiresAt <= nowTimestamp || Boolean(token.revokedAt)) {
          state.verifierTokensByValue.delete(tokenValue);
        }
      }
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
