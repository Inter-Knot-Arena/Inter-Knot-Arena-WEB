import type {
  Agent,
  Challenge,
  Dispute,
  League,
  Match,
  MatchState,
  OAuthAccount,
  PasswordAccount,
  QueueConfig,
  Rating,
  Ruleset,
  Season,
  Session,
  User
} from "@ika/shared";

export type MatchmakingEntryStatus = "WAITING" | "MATCH_FOUND";

export interface MatchmakingEntry {
  id: string;
  queueId: string;
  userId: string;
  status: MatchmakingEntryStatus;
  matchId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OAuthAccountRecord extends OAuthAccount {
  createdAt: number;
  updatedAt: number;
}

export interface PasswordAccountRecord extends PasswordAccount {
  createdAt: number;
  updatedAt: number;
}

export interface Repository {
  listAgents(): Promise<Agent[]>;
  listLeagues(): Promise<League[]>;
  listRulesets(): Promise<Ruleset[]>;
  listChallenges(): Promise<Challenge[]>;
  listQueues(): Promise<QueueConfig[]>;
  listUsers(): Promise<User[]>;
  listRatingsByUser(userId: string): Promise<Rating[]>;
  listLeaderboard(leagueId: string): Promise<Rating[]>;
  findRating(userId: string, leagueId: string): Promise<Rating | null>;
  saveRating(rating: Rating): Promise<Rating>;
  listMatchesByStates(states: MatchState[]): Promise<Match[]>;
  getActiveSeason(): Promise<Season>;
  findRuleset(rulesetId: string): Promise<Ruleset>;
  findQueue(queueId: string): Promise<QueueConfig>;
  findUser(userId: string): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findOpponent(userId: string): Promise<User | null>;
  findMatch(matchId: string): Promise<Match>;
  createUser(user: User): Promise<User>;
  saveUser(user: User): Promise<User>;
  createMatch(match: Match): Promise<Match>;
  saveMatch(match: Match): Promise<Match>;
  listMatchmakingEntries(): Promise<MatchmakingEntry[]>;
  findMatchmakingEntry(entryId: string): Promise<MatchmakingEntry>;
  findMatchmakingEntryByUser(queueId: string, userId: string): Promise<MatchmakingEntry | null>;
  findWaitingMatchmakingEntry(queueId: string, excludeUserId: string): Promise<MatchmakingEntry | null>;
  createMatchmakingEntry(entry: MatchmakingEntry): Promise<MatchmakingEntry>;
  saveMatchmakingEntry(entry: MatchmakingEntry): Promise<MatchmakingEntry>;
  deleteMatchmakingEntry(entryId: string): Promise<void>;
  listOpenDisputes(): Promise<Dispute[]>;
  listDisputesByMatch(matchId: string): Promise<Dispute[]>;
  findDispute(disputeId: string): Promise<Dispute>;
  createDispute(dispute: Dispute): Promise<Dispute>;
  saveDispute(dispute: Dispute): Promise<Dispute>;
  findOAuthAccount(
    provider: OAuthAccount["provider"],
    providerAccountId: string
  ): Promise<OAuthAccountRecord | null>;
  findOAuthAccountByEmail(email: string): Promise<OAuthAccountRecord | null>;
  saveOAuthAccount(account: OAuthAccountRecord): Promise<OAuthAccountRecord>;
  findPasswordAccountByEmail(email: string): Promise<PasswordAccountRecord | null>;
  findPasswordAccountByUserId(userId: string): Promise<PasswordAccountRecord | null>;
  savePasswordAccount(account: PasswordAccountRecord): Promise<PasswordAccountRecord>;
  createSession(session: Session): Promise<Session>;
  findSession(sessionId: string): Promise<Session | null>;
  deleteSession(sessionId: string): Promise<void>;
  purgeExpiredSessions(nowTimestamp: number): Promise<void>;
}
