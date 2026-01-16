import { closePool, getPool } from "./pool";
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

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

const pool = getPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");

  for (const league of leagues) {
    await client.query(
      `INSERT INTO leagues (id, name, type, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           type = EXCLUDED.type,
           description = EXCLUDED.description`,
      [league.id, league.name, league.type, league.description]
    );
  }

  for (const agent of agents) {
    await client.query(
      `INSERT INTO agents (id, name, element, faction, role, icon_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           element = EXCLUDED.element,
           faction = EXCLUDED.faction,
           role = EXCLUDED.role,
           icon_url = EXCLUDED.icon_url`,
      [agent.id, agent.name, agent.element, agent.faction, agent.role, agent.iconUrl ?? null]
    );
  }

  for (const ruleset of rulesets) {
    await client.query(
      `INSERT INTO rulesets (
         id,
         league_id,
         version,
         name,
         description,
         allowed_agents,
         dupes_policy,
         signature_policy,
         level_caps,
         gear_caps,
         require_verifier,
         require_inrun_check,
         evidence_policy,
         precheck_frequency_sec,
         inrun_frequency_sec,
         privacy_mode
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (id) DO UPDATE
       SET league_id = EXCLUDED.league_id,
           version = EXCLUDED.version,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           allowed_agents = EXCLUDED.allowed_agents,
           dupes_policy = EXCLUDED.dupes_policy,
           signature_policy = EXCLUDED.signature_policy,
           level_caps = EXCLUDED.level_caps,
           gear_caps = EXCLUDED.gear_caps,
           require_verifier = EXCLUDED.require_verifier,
           require_inrun_check = EXCLUDED.require_inrun_check,
           evidence_policy = EXCLUDED.evidence_policy,
           precheck_frequency_sec = EXCLUDED.precheck_frequency_sec,
           inrun_frequency_sec = EXCLUDED.inrun_frequency_sec,
           privacy_mode = EXCLUDED.privacy_mode`,
      [
        ruleset.id,
        ruleset.leagueId,
        ruleset.version,
        ruleset.name,
        ruleset.description,
        toJson(ruleset.allowedAgents),
        toJson(ruleset.dupesPolicy),
        toJson(ruleset.signaturePolicy),
        toJson(ruleset.levelCaps),
        toJson(ruleset.gearCaps),
        ruleset.requireVerifier,
        ruleset.requireInrunCheck,
        toJson(ruleset.evidencePolicy),
        ruleset.precheckFrequencySec,
        ruleset.inrunFrequencySec,
        ruleset.privacyMode
      ]
    );
  }

  for (const challenge of challenges) {
    await client.query(
      `INSERT INTO challenges (id, name, description, metric_type, allowed_proofs)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           metric_type = EXCLUDED.metric_type,
           allowed_proofs = EXCLUDED.allowed_proofs`,
      [
        challenge.id,
        challenge.name,
        challenge.description,
        challenge.metricType,
        toJson(challenge.allowedProofs)
      ]
    );
  }

  for (const season of seasons) {
    await client.query(
      `INSERT INTO seasons (id, name, status, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           status = EXCLUDED.status,
           starts_at = EXCLUDED.starts_at,
           ends_at = EXCLUDED.ends_at`,
      [season.id, season.name, season.status, season.startsAt, season.endsAt]
    );
  }

  for (const user of users) {
    await client.query(
      `INSERT INTO users (
         id,
         handle,
         display_name,
         region,
         roles,
         trust_score,
         proxy_level,
         verified_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
       SET handle = EXCLUDED.handle,
           display_name = EXCLUDED.display_name,
           region = EXCLUDED.region,
           roles = EXCLUDED.roles,
           trust_score = EXCLUDED.trust_score,
           proxy_level = EXCLUDED.proxy_level,
           verified_status = EXCLUDED.verified_status`,
      [
        user.id,
        user.handle,
        user.displayName,
        user.region,
        toJson(user.roles),
        user.trustScore,
        user.proxyLevel,
        user.verifiedStatus
      ]
    );
  }

  for (const rating of ratings) {
    await client.query(
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
  }

  for (const queue of queues) {
    await client.query(
      `INSERT INTO queues (
         id,
         league_id,
         ruleset_id,
         challenge_id,
         name,
         description,
         require_verifier
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
       SET league_id = EXCLUDED.league_id,
           ruleset_id = EXCLUDED.ruleset_id,
           challenge_id = EXCLUDED.challenge_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           require_verifier = EXCLUDED.require_verifier`,
      [
        queue.id,
        queue.leagueId,
        queue.rulesetId,
        queue.challengeId,
        queue.name,
        queue.description,
        queue.requireVerifier
      ]
    );
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await closePool();
}
