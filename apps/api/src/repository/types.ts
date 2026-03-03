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

export type VerifierDeviceRequestStatus = "PENDING" | "AUTHORIZED" | "CONSUMED";

export interface VerifierDeviceRequest {
  id: string;
  codeChallenge: string;
  redirectUri: string;
  state?: string;
  userId?: string;
  exchangeCode?: string;
  status: VerifierDeviceRequestStatus;
  createdAt: number;
  expiresAt: number;
  authorizedAt?: number;
  consumedAt?: number;
}

export type VerifierTokenKind = "ACCESS" | "REFRESH";

export interface VerifierTokenRecord {
  id: string;
  userId: string;
  token: string;
  kind: VerifierTokenKind;
  createdAt: number;
  expiresAt: number;
  revokedAt?: number;
  rotatedFromTokenId?: string;
}

export interface Repository {
  listAgents(): Promise<Agent[]>;
  listLeagues(): Promise<League[]>;
  listRulesets(): Promise<Ruleset[]>;
  listChallenges(): Promise<Challenge[]>;
  listQueues(): Promise<QueueConfig[]>;
  listSeasons(): Promise<Season[]>;
  listUsers(): Promise<User[]>;
  listRatingsByUser(userId: string): Promise<Rating[]>;
  listLeaderboard(leagueId: string): Promise<Rating[]>;
  findRating(userId: string, leagueId: string): Promise<Rating | null>;
  saveRating(rating: Rating): Promise<Rating>;
  listMatchesByStates(states: MatchState[]): Promise<Match[]>;
  listMatchesByUser(userId: string): Promise<Match[]>;
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
  listDisputesByMatchIds(matchIds: string[]): Promise<Dispute[]>;
  findDispute(disputeId: string): Promise<Dispute>;
  createDispute(dispute: Dispute): Promise<Dispute>;
  saveDispute(dispute: Dispute): Promise<Dispute>;
  saveRuleset(ruleset: Ruleset): Promise<Ruleset>;
  saveSeason(season: Season): Promise<Season>;
  findOAuthAccount(
    provider: OAuthAccount["provider"],
    providerAccountId: string
  ): Promise<OAuthAccountRecord | null>;
  findOAuthAccountByEmail(email: string): Promise<OAuthAccountRecord | null>;
  saveOAuthAccount(account: OAuthAccountRecord): Promise<OAuthAccountRecord>;
  deleteOAuthAccountsByUserId(userId: string): Promise<number>;
  findPasswordAccountByEmail(email: string): Promise<PasswordAccountRecord | null>;
  findPasswordAccountByUserId(userId: string): Promise<PasswordAccountRecord | null>;
  savePasswordAccount(account: PasswordAccountRecord): Promise<PasswordAccountRecord>;
  deletePasswordAccountsByUserId(userId: string): Promise<number>;
  createSession(session: Session): Promise<Session>;
  findSession(sessionId: string): Promise<Session | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteSessionsByUserId(userId: string): Promise<number>;
  purgeExpiredSessions(nowTimestamp: number): Promise<void>;
  createVerifierDeviceRequest(
    request: VerifierDeviceRequest
  ): Promise<VerifierDeviceRequest>;
  findVerifierDeviceRequest(requestId: string): Promise<VerifierDeviceRequest | null>;
  saveVerifierDeviceRequest(request: VerifierDeviceRequest): Promise<VerifierDeviceRequest>;
  consumeVerifierDeviceCode(
    requestId: string,
    exchangeCode: string
  ): Promise<VerifierDeviceRequest | null>;
  createVerifierToken(token: VerifierTokenRecord): Promise<VerifierTokenRecord>;
  findVerifierToken(
    token: string,
    kind?: VerifierTokenKind
  ): Promise<VerifierTokenRecord | null>;
  rotateVerifierToken(args: {
    refreshToken: string;
    nextAccessToken: VerifierTokenRecord;
    nextRefreshToken: VerifierTokenRecord;
    rotatedAt: number;
  }): Promise<{ accessToken: VerifierTokenRecord; refreshToken: VerifierTokenRecord } | null>;
  revokeVerifierToken(token: string, revokedAt: number): Promise<boolean>;
  purgeExpiredVerifierAuth(nowTimestamp: number): Promise<void>;
}
