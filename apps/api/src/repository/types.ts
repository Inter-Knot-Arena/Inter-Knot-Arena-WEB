import type {
  Agent,
  Challenge,
  Dispute,
  League,
  Match,
  QueueConfig,
  Rating,
  Ruleset,
  Season,
  User
} from "@ika/shared";

export interface Repository {
  listAgents(): Promise<Agent[]>;
  listLeagues(): Promise<League[]>;
  listRulesets(): Promise<Ruleset[]>;
  listChallenges(): Promise<Challenge[]>;
  listQueues(): Promise<QueueConfig[]>;
  listUsers(): Promise<User[]>;
  listRatingsByUser(userId: string): Promise<Rating[]>;
  listLeaderboard(leagueId: string): Promise<Rating[]>;
  getActiveSeason(): Promise<Season>;
  findRuleset(rulesetId: string): Promise<Ruleset>;
  findQueue(queueId: string): Promise<QueueConfig>;
  findUser(userId: string): Promise<User>;
  findOpponent(userId: string): Promise<User | null>;
  findMatch(matchId: string): Promise<Match>;
  createMatch(match: Match): Promise<Match>;
  saveMatch(match: Match): Promise<Match>;
  listOpenDisputes(): Promise<Dispute[]>;
  findDispute(disputeId: string): Promise<Dispute>;
  createDispute(dispute: Dispute): Promise<Dispute>;
  saveDispute(dispute: Dispute): Promise<Dispute>;
}
