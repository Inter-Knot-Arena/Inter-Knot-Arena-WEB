import type {
  Agent,
  Challenge,
  Dispute,
  League,
  Match,
  MatchState,
  OAuthAccount,
  QueueConfig,
  Rating,
  Ruleset,
  Season,
  Session,
  User
} from "@ika/shared";
import type { Pool } from "pg";
import { getPool } from "../db/pool.js";
import type {
  MatchmakingEntry,
  OAuthAccountRecord,
  PasswordAccountRecord,
  Repository
} from "./types.js";

export function createPostgresRepository(): Repository {
  return new PostgresRepository(getPool());
}

class PostgresRepository implements Repository {
  constructor(private readonly pool: Pool) {}

  async listAgents(): Promise<Agent[]> {
    const result = await this.pool.query("SELECT * FROM agents ORDER BY name");
    return result.rows.map(mapAgent);
  }

  async listLeagues(): Promise<League[]> {
    const result = await this.pool.query("SELECT * FROM leagues ORDER BY name");
    return result.rows.map(mapLeague);
  }

  async listRulesets(): Promise<Ruleset[]> {
    const result = await this.pool.query("SELECT * FROM rulesets ORDER BY name");
    return result.rows.map(mapRuleset);
  }

  async listChallenges(): Promise<Challenge[]> {
    const result = await this.pool.query("SELECT * FROM challenges ORDER BY name");
    return result.rows.map(mapChallenge);
  }

  async listQueues(): Promise<QueueConfig[]> {
    const result = await this.pool.query("SELECT * FROM queues ORDER BY name");
    return result.rows.map(mapQueue);
  }

  async listUsers(): Promise<User[]> {
    const result = await this.pool.query("SELECT * FROM users ORDER BY display_name");
    return result.rows.map(mapUser);
  }

  async listRatingsByUser(userId: string): Promise<Rating[]> {
    const result = await this.pool.query(
      "SELECT * FROM ratings WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId]
    );
    return result.rows.map(mapRating);
  }

  async listLeaderboard(leagueId: string): Promise<Rating[]> {
    const result = await this.pool.query(
      "SELECT * FROM ratings WHERE league_id = $1 ORDER BY elo DESC LIMIT 100",
      [leagueId]
    );
    return result.rows.map(mapRating);
  }

  async findRating(userId: string, leagueId: string): Promise<Rating | null> {
    const result = await this.pool.query(
      "SELECT * FROM ratings WHERE user_id = $1 AND league_id = $2",
      [userId, leagueId]
    );
    const row = result.rows[0];
    return row ? mapRating(row) : null;
  }

  async saveRating(rating: Rating): Promise<Rating> {
    await this.pool.query(
      `INSERT INTO ratings (user_id, league_id, elo, provisional_matches, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, league_id) DO UPDATE
       SET elo = EXCLUDED.elo,
           provisional_matches = EXCLUDED.provisional_matches,
           updated_at = EXCLUDED.updated_at`,
      [
        rating.userId,
        rating.leagueId,
        rating.elo,
        rating.provisionalMatches,
        rating.updatedAt
      ]
    );
    return rating;
  }

  async listMatchesByStates(states: MatchState[]): Promise<Match[]> {
    if (states.length === 0) {
      return [];
    }
    const result = await this.pool.query("SELECT * FROM matches WHERE state = ANY($1)", [states]);
    return result.rows.map(mapMatch);
  }

  async getActiveSeason(): Promise<Season> {
    const result = await this.pool.query(
      "SELECT * FROM seasons WHERE status = $1 ORDER BY starts_at DESC LIMIT 1",
      ["ACTIVE"]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("No active season configured");
    }
    return mapSeason(row);
  }

  async findRuleset(rulesetId: string): Promise<Ruleset> {
    const result = await this.pool.query("SELECT * FROM rulesets WHERE id = $1", [rulesetId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error("Ruleset not found");
    }
    return mapRuleset(row);
  }

  async findQueue(queueId: string): Promise<QueueConfig> {
    const result = await this.pool.query("SELECT * FROM queues WHERE id = $1", [queueId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error("Queue not found");
    }
    return mapQueue(row);
  }

  async findUser(userId: string): Promise<User> {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error("User not found");
    }
    return mapUser(row);
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  }

  async findOpponent(userId: string): Promise<User | null> {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE id <> $1 ORDER BY random() LIMIT 1",
      [userId]
    );
    const row = result.rows[0];
    return row ? mapUser(row) : null;
  }

  async findMatch(matchId: string): Promise<Match> {
    const result = await this.pool.query("SELECT * FROM matches WHERE id = $1", [matchId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error("Match not found");
    }
    return mapMatch(row);
  }

  async createUser(user: User): Promise<User> {
    const payload = serializeUser(user);
    await this.pool.query(
      `INSERT INTO users (
         id,
         email,
         display_name,
         avatar_url,
         region,
         roles,
         trust_score,
         proxy_level,
         verification,
         privacy,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        payload.id,
        payload.email,
        payload.displayName,
        payload.avatarUrl,
        payload.region,
        payload.roles,
        payload.trustScore,
        payload.proxyLevel,
        payload.verification,
        payload.privacy,
        payload.createdAt,
        payload.updatedAt
      ]
    );
    return user;
  }

  async saveUser(user: User): Promise<User> {
    const payload = serializeUser(user);
    const result = await this.pool.query(
      `UPDATE users
       SET email = $1,
           display_name = $2,
           avatar_url = $3,
           region = $4,
           roles = $5,
           trust_score = $6,
           proxy_level = $7,
           verification = $8,
           privacy = $9,
           created_at = $10,
           updated_at = $11
       WHERE id = $12`,
      [
        payload.email,
        payload.displayName,
        payload.avatarUrl,
        payload.region,
        payload.roles,
        payload.trustScore,
        payload.proxyLevel,
        payload.verification,
        payload.privacy,
        payload.createdAt,
        payload.updatedAt,
        payload.id
      ]
    );
    if (result.rowCount === 0) {
      throw new Error("User not found");
    }
    return user;
  }

  async createMatch(match: Match): Promise<Match> {
    const payload = serializeMatch(match);
    await this.pool.query(
      `INSERT INTO matches (
         id,
         queue_id,
         state,
         league_id,
         ruleset_id,
         challenge_id,
         season_id,
         players,
         draft,
         evidence,
         confirmed_by,
         resolution,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        payload.id,
        payload.queueId,
        payload.state,
        payload.leagueId,
        payload.rulesetId,
        payload.challengeId,
        payload.seasonId,
        payload.players,
        payload.draft,
        payload.evidence,
        payload.confirmedBy,
        payload.resolution,
        payload.createdAt,
        payload.updatedAt
      ]
    );
    return match;
  }

  async saveMatch(match: Match): Promise<Match> {
    const payload = serializeMatch(match);
    const result = await this.pool.query(
      `UPDATE matches
       SET queue_id = $1,
           state = $2,
           league_id = $3,
           ruleset_id = $4,
           challenge_id = $5,
           season_id = $6,
           players = $7,
           draft = $8,
           evidence = $9,
           confirmed_by = $10,
           resolution = $11,
           created_at = $12,
           updated_at = $13
       WHERE id = $14`,
      [
        payload.queueId,
        payload.state,
        payload.leagueId,
        payload.rulesetId,
        payload.challengeId,
        payload.seasonId,
        payload.players,
        payload.draft,
        payload.evidence,
        payload.confirmedBy,
        payload.resolution,
        payload.createdAt,
        payload.updatedAt,
        payload.id
      ]
    );
    if (result.rowCount === 0) {
      throw new Error("Match not found");
    }
    return match;
  }

  async listMatchmakingEntries(): Promise<MatchmakingEntry[]> {
    const result = await this.pool.query("SELECT * FROM matchmaking_queue");
    return result.rows.map(mapMatchmakingEntry);
  }

  async findMatchmakingEntry(entryId: string): Promise<MatchmakingEntry> {
    const result = await this.pool.query("SELECT * FROM matchmaking_queue WHERE id = $1", [entryId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error("Matchmaking ticket not found");
    }
    return mapMatchmakingEntry(row);
  }

  async findMatchmakingEntryByUser(queueId: string, userId: string): Promise<MatchmakingEntry | null> {
    const result = await this.pool.query(
      "SELECT * FROM matchmaking_queue WHERE queue_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1",
      [queueId, userId]
    );
    const row = result.rows[0];
    return row ? mapMatchmakingEntry(row) : null;
  }

  async findWaitingMatchmakingEntry(queueId: string, excludeUserId: string): Promise<MatchmakingEntry | null> {
    const result = await this.pool.query(
      "SELECT * FROM matchmaking_queue WHERE queue_id = $1 AND status = $2 AND user_id <> $3 ORDER BY created_at ASC LIMIT 1",
      [queueId, "WAITING", excludeUserId]
    );
    const row = result.rows[0];
    return row ? mapMatchmakingEntry(row) : null;
  }

  async createMatchmakingEntry(entry: MatchmakingEntry): Promise<MatchmakingEntry> {
    await this.pool.query(
      `INSERT INTO matchmaking_queue (
         id,
         queue_id,
         user_id,
         status,
         match_id,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.id,
        entry.queueId,
        entry.userId,
        entry.status,
        entry.matchId ?? null,
        entry.createdAt,
        entry.updatedAt
      ]
    );
    return entry;
  }

  async saveMatchmakingEntry(entry: MatchmakingEntry): Promise<MatchmakingEntry> {
    const result = await this.pool.query(
      `UPDATE matchmaking_queue
       SET queue_id = $1,
           user_id = $2,
           status = $3,
           match_id = $4,
           created_at = $5,
           updated_at = $6
       WHERE id = $7`,
      [
        entry.queueId,
        entry.userId,
        entry.status,
        entry.matchId ?? null,
        entry.createdAt,
        entry.updatedAt,
        entry.id
      ]
    );
    if (result.rowCount === 0) {
      throw new Error("Matchmaking ticket not found");
    }
    return entry;
  }

  async deleteMatchmakingEntry(entryId: string): Promise<void> {
    await this.pool.query("DELETE FROM matchmaking_queue WHERE id = $1", [entryId]);
  }

  async listOpenDisputes(): Promise<Dispute[]> {
    const result = await this.pool.query(
      "SELECT * FROM disputes WHERE status = $1 ORDER BY created_at ASC",
      ["OPEN"]
    );
    return result.rows.map(mapDispute);
  }

  async listDisputesByMatch(matchId: string): Promise<Dispute[]> {
    const result = await this.pool.query(
      "SELECT * FROM disputes WHERE match_id = $1 ORDER BY created_at ASC",
      [matchId]
    );
    return result.rows.map(mapDispute);
  }

  async findDispute(disputeId: string): Promise<Dispute> {
    const result = await this.pool.query("SELECT * FROM disputes WHERE id = $1", [disputeId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error("Dispute not found");
    }
    return mapDispute(row);
  }

  async createDispute(dispute: Dispute): Promise<Dispute> {
    await this.pool.query(
      `INSERT INTO disputes (
         id,
         match_id,
         opened_by,
         reason,
         status,
         decision,
         evidence_urls,
         resolved_by,
         winner_user_id,
         created_at,
         resolved_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        dispute.id,
        dispute.matchId,
        dispute.openedBy,
        dispute.reason,
        dispute.status,
        dispute.decision ?? null,
        toJson(dispute.evidenceUrls),
        dispute.resolvedBy ?? null,
        dispute.winnerUserId ?? null,
        dispute.createdAt,
        dispute.resolvedAt ?? null
      ]
    );
    return dispute;
  }

  async saveDispute(dispute: Dispute): Promise<Dispute> {
    const result = await this.pool.query(
      `UPDATE disputes
       SET match_id = $1,
           opened_by = $2,
           reason = $3,
           status = $4,
           decision = $5,
           evidence_urls = $6,
           resolved_by = $7,
           winner_user_id = $8,
           created_at = $9,
           resolved_at = $10
       WHERE id = $11`,
      [
        dispute.matchId,
        dispute.openedBy,
        dispute.reason,
        dispute.status,
        dispute.decision ?? null,
        toJson(dispute.evidenceUrls),
        dispute.resolvedBy ?? null,
        dispute.winnerUserId ?? null,
        dispute.createdAt,
        dispute.resolvedAt ?? null,
        dispute.id
      ]
    );
    if (result.rowCount === 0) {
      throw new Error("Dispute not found");
    }
    return dispute;
  }

  async findOAuthAccount(
    provider: OAuthAccount["provider"],
    providerAccountId: string
  ): Promise<OAuthAccountRecord | null> {
    const result = await this.pool.query(
      `SELECT *
       FROM oauth_accounts
       WHERE provider = $1 AND provider_account_id = $2`,
      [provider, providerAccountId]
    );
    const row = result.rows[0];
    return row ? mapOAuthAccount(row) : null;
  }

  async findOAuthAccountByEmail(email: string): Promise<OAuthAccountRecord | null> {
    const result = await this.pool.query(
      `SELECT *
       FROM oauth_accounts
       WHERE email = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [email]
    );
    const row = result.rows[0];
    return row ? mapOAuthAccount(row) : null;
  }

  async saveOAuthAccount(account: OAuthAccountRecord): Promise<OAuthAccountRecord> {
    await this.pool.query(
      `INSERT INTO oauth_accounts (
         provider,
         provider_account_id,
         user_id,
         email,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (provider, provider_account_id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           email = EXCLUDED.email,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
      [
        account.provider,
        account.providerAccountId,
        account.userId,
        account.email,
        account.createdAt,
        account.updatedAt
      ]
    );
    return account;
  }

  async findPasswordAccountByEmail(email: string): Promise<PasswordAccountRecord | null> {
    const result = await this.pool.query(
      `SELECT *
       FROM password_accounts
       WHERE email = $1`,
      [email]
    );
    const row = result.rows[0];
    return row ? mapPasswordAccount(row) : null;
  }

  async findPasswordAccountByUserId(userId: string): Promise<PasswordAccountRecord | null> {
    const result = await this.pool.query(
      `SELECT *
       FROM password_accounts
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    return row ? mapPasswordAccount(row) : null;
  }

  async savePasswordAccount(account: PasswordAccountRecord): Promise<PasswordAccountRecord> {
    await this.pool.query(
      `INSERT INTO password_accounts (
         user_id,
         email,
         password_hash,
         password_salt,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           password_hash = EXCLUDED.password_hash,
           password_salt = EXCLUDED.password_salt,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
      [
        account.userId,
        account.email,
        account.passwordHash,
        account.passwordSalt,
        account.createdAt,
        account.updatedAt
      ]
    );
    return account;
  }

  async createSession(session: Session): Promise<Session> {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           created_at = EXCLUDED.created_at,
           expires_at = EXCLUDED.expires_at`,
      [session.id, session.userId, session.createdAt, session.expiresAt]
    );
    return session;
  }

  async findSession(sessionId: string): Promise<Session | null> {
    const result = await this.pool.query(
      `SELECT *
       FROM sessions
       WHERE id = $1`,
      [sessionId]
    );
    const row = result.rows[0];
    return row ? mapSession(row) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM sessions
       WHERE id = $1`,
      [sessionId]
    );
  }

  async purgeExpiredSessions(nowTimestamp: number): Promise<void> {
    await this.pool.query(
      `DELETE FROM sessions
       WHERE expires_at <= $1`,
      [nowTimestamp]
    );
  }
}

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function mapAgent(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    name: String(row.name),
    element: String(row.element),
    faction: String(row.faction),
    role: String(row.role),
    iconUrl: (row.icon_url as string | null) ?? undefined
  };
}

function mapLeague(row: Record<string, unknown>): League {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as League["type"],
    description: String(row.description)
  };
}

function mapRuleset(row: Record<string, unknown>): Ruleset {
  return {
    id: String(row.id),
    leagueId: String(row.league_id),
    version: String(row.version),
    name: String(row.name),
    description: String(row.description),
    allowedAgents: (row.allowed_agents as Ruleset["allowedAgents"]) ?? undefined,
    dupesPolicy: (row.dupes_policy as Ruleset["dupesPolicy"]) ?? undefined,
    signaturePolicy: (row.signature_policy as Ruleset["signaturePolicy"]) ?? undefined,
    levelCaps: (row.level_caps as Ruleset["levelCaps"]) ?? undefined,
    gearCaps: (row.gear_caps as Ruleset["gearCaps"]) ?? undefined,
    requireVerifier: Boolean(row.require_verifier),
    requireInrunCheck: Boolean(row.require_inrun_check),
    evidencePolicy: row.evidence_policy as Ruleset["evidencePolicy"],
    precheckFrequencySec: Number(row.precheck_frequency_sec),
    inrunFrequencySec: Number(row.inrun_frequency_sec),
    privacyMode: row.privacy_mode as Ruleset["privacyMode"]
  };
}

function mapChallenge(row: Record<string, unknown>): Challenge {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    metricType: row.metric_type as Challenge["metricType"],
    allowedProofs: row.allowed_proofs as Challenge["allowedProofs"]
  };
}

function mapSeason(row: Record<string, unknown>): Season {
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status as Season["status"],
    startsAt: toNumber(row.starts_at),
    endsAt: toNumber(row.ends_at)
  };
}

function mapUser(row: Record<string, unknown>): User {
  const proxyFallback = { level: 1, xp: 0, nextXp: 100 };
  const privacyFallback = { showUidPublicly: false, showMatchHistoryPublicly: true };
  const verificationFallback = { status: "UNVERIFIED" as const };
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    displayName: String(row.display_name),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    region: String(row.region) as User["region"],
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    roles: parseJson<User["roles"]>(row.roles, []),
    trustScore: Number(row.trust_score),
    proxyLevel: normalizeProxyLevel(row.proxy_level, proxyFallback),
    verification: parseJson<User["verification"]>(row.verification, verificationFallback),
    privacy: parseJson<User["privacy"]>(row.privacy, privacyFallback)
  };
}

function mapRating(row: Record<string, unknown>): Rating {
  return {
    userId: String(row.user_id),
    leagueId: String(row.league_id),
    elo: Number(row.elo),
    provisionalMatches: Number(row.provisional_matches),
    updatedAt: toNumber(row.updated_at)
  };
}

function mapQueue(row: Record<string, unknown>): QueueConfig {
  return {
    id: String(row.id),
    leagueId: String(row.league_id),
    rulesetId: String(row.ruleset_id),
    challengeId: String(row.challenge_id),
    name: String(row.name),
    description: String(row.description),
    requireVerifier: Boolean(row.require_verifier)
  };
}

function mapMatch(row: Record<string, unknown>): Match {
  const evidence = (row.evidence as Match["evidence"]) ?? { precheck: [], inrun: [] };
  return {
    id: String(row.id),
    queueId: (row.queue_id as string | null) ?? undefined,
    state: row.state as Match["state"],
    leagueId: String(row.league_id),
    rulesetId: String(row.ruleset_id),
    challengeId: String(row.challenge_id),
    seasonId: String(row.season_id),
    players: (row.players as Match["players"]) ?? [],
    draft: row.draft as Match["draft"],
    evidence: {
      precheck: evidence.precheck ?? [],
      inrun: evidence.inrun ?? [],
      result: evidence.result ?? undefined
    },
    confirmedBy: (row.confirmed_by as Match["confirmedBy"]) ?? [],
    resolution: (row.resolution as Match["resolution"]) ?? undefined,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at)
  };
}

function mapMatchmakingEntry(row: Record<string, unknown>): MatchmakingEntry {
  return {
    id: String(row.id),
    queueId: String(row.queue_id),
    userId: String(row.user_id),
    status: row.status as MatchmakingEntry["status"],
    matchId: (row.match_id as string | null) ?? undefined,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at)
  };
}

function mapDispute(row: Record<string, unknown>): Dispute {
  return {
    id: String(row.id),
    matchId: String(row.match_id),
    openedBy: String(row.opened_by),
    reason: String(row.reason),
    status: row.status as Dispute["status"],
    decision: (row.decision as string | null) ?? undefined,
    evidenceUrls: parseJson<string[]>(row.evidence_urls, []),
    resolvedBy: (row.resolved_by as string | null) ?? undefined,
    winnerUserId: (row.winner_user_id as string | null) ?? undefined,
    createdAt: toNumber(row.created_at),
    resolvedAt: row.resolved_at ? toNumber(row.resolved_at) : undefined
  };
}

function mapOAuthAccount(row: Record<string, unknown>): OAuthAccountRecord {
  return {
    provider: String(row.provider) as OAuthAccount["provider"],
    providerAccountId: String(row.provider_account_id),
    userId: String(row.user_id),
    email: String(row.email),
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at)
  };
}

function mapPasswordAccount(row: Record<string, unknown>): PasswordAccountRecord {
  return {
    userId: String(row.user_id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    passwordSalt: String(row.password_salt),
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at)
  };
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    createdAt: toNumber(row.created_at),
    expiresAt: toNumber(row.expires_at)
  };
}

function serializeMatch(match: Match) {
  const evidence = {
    precheck: match.evidence.precheck ?? [],
    inrun: match.evidence.inrun ?? [],
    result: match.evidence.result ?? null
  };
  return {
    id: match.id,
    queueId: match.queueId ?? null,
    state: match.state,
    leagueId: match.leagueId,
    rulesetId: match.rulesetId,
    challengeId: match.challengeId,
    seasonId: match.seasonId,
    players: toJson(match.players ?? []),
    draft: toJson(match.draft),
    evidence: toJson(evidence),
    confirmedBy: toJson(match.confirmedBy ?? []),
    resolution: toJson(match.resolution),
    createdAt: match.createdAt,
    updatedAt: match.updatedAt
  };
}

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    region: user.region,
    roles: toJson(user.roles),
    trustScore: user.trustScore,
    proxyLevel: toJson(user.proxyLevel),
    verification: toJson(user.verification),
    privacy: toJson(user.privacy),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function normalizeProxyLevel(value: unknown, fallback: User["proxyLevel"]): User["proxyLevel"] {
  if (typeof value === "number") {
    return { level: value, xp: 0, nextXp: Math.max(100, value * 50) };
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return { level: parsed, xp: 0, nextXp: Math.max(100, parsed * 50) };
    }
  }
  return parseJson<User["proxyLevel"]>(value, fallback);
}

