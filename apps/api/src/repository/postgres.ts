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
import type { Pool } from "pg";
import { getPool } from "../db/pool";
import type { Repository } from "./types";

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
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
           created_at = $11,
           updated_at = $12
       WHERE id = $13`,
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

  async listOpenDisputes(): Promise<Dispute[]> {
    const result = await this.pool.query(
      "SELECT * FROM disputes WHERE status = $1 ORDER BY created_at ASC",
      ["OPEN"]
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
         created_at,
         resolved_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        dispute.id,
        dispute.matchId,
        dispute.openedBy,
        dispute.reason,
        dispute.status,
        dispute.decision ?? null,
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
           created_at = $6,
           resolved_at = $7
       WHERE id = $8`,
      [
        dispute.matchId,
        dispute.openedBy,
        dispute.reason,
        dispute.status,
        dispute.decision ?? null,
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
  return {
    id: String(row.id),
    handle: String(row.handle),
    displayName: String(row.display_name),
    region: String(row.region),
    roles: (row.roles as User["roles"]) ?? [],
    trustScore: Number(row.trust_score),
    proxyLevel: Number(row.proxy_level),
    verifiedStatus: row.verified_status as User["verifiedStatus"]
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
    createdAt: toNumber(row.created_at),
    resolvedAt: row.resolved_at ? toNumber(row.resolved_at) : undefined
  };
}

function serializeMatch(match: Match) {
  return {
    id: match.id,
    queueId: match.queueId ?? null,
    state: match.state,
    leagueId: match.leagueId,
    rulesetId: match.rulesetId,
    challengeId: match.challengeId,
    seasonId: match.seasonId,
    players: match.players ?? [],
    draft: match.draft,
    evidence: {
      precheck: match.evidence.precheck ?? [],
      inrun: match.evidence.inrun ?? [],
      result: match.evidence.result ?? null
    },
    confirmedBy: match.confirmedBy ?? [],
    createdAt: match.createdAt,
    updatedAt: match.updatedAt
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
