CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  name text NOT NULL,
  element text NOT NULL,
  faction text NOT NULL,
  role text NOT NULL,
  icon_url text
);

CREATE TABLE IF NOT EXISTS leagues (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS rulesets (
  id text PRIMARY KEY,
  league_id text NOT NULL REFERENCES leagues(id) ON DELETE RESTRICT,
  version text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  allowed_agents jsonb,
  dupes_policy jsonb,
  signature_policy jsonb,
  level_caps jsonb,
  gear_caps jsonb,
  require_verifier boolean NOT NULL,
  require_inrun_check boolean NOT NULL,
  evidence_policy jsonb NOT NULL,
  precheck_frequency_sec integer NOT NULL,
  inrun_frequency_sec integer NOT NULL,
  privacy_mode text NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  metric_type text NOT NULL,
  allowed_proofs jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL,
  starts_at bigint NOT NULL,
  ends_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  handle text NOT NULL,
  display_name text NOT NULL,
  region text NOT NULL,
  roles jsonb NOT NULL,
  trust_score integer NOT NULL,
  proxy_level integer NOT NULL,
  verified_status text NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  elo integer NOT NULL,
  provisional_matches integer NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (user_id, league_id)
);

CREATE TABLE IF NOT EXISTS queues (
  id text PRIMARY KEY,
  league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  ruleset_id text NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  challenge_id text NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  require_verifier boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id text PRIMARY KEY,
  queue_id text REFERENCES queues(id) ON DELETE SET NULL,
  state text NOT NULL,
  league_id text NOT NULL REFERENCES leagues(id) ON DELETE RESTRICT,
  ruleset_id text NOT NULL REFERENCES rulesets(id) ON DELETE RESTRICT,
  challenge_id text NOT NULL REFERENCES challenges(id) ON DELETE RESTRICT,
  season_id text NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  players jsonb NOT NULL,
  draft jsonb NOT NULL,
  evidence jsonb NOT NULL,
  confirmed_by jsonb NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS disputes (
  id text PRIMARY KEY,
  match_id text NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  opened_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL,
  decision text,
  created_at bigint NOT NULL,
  resolved_at bigint
);

CREATE INDEX IF NOT EXISTS idx_ratings_league ON ratings (league_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status);
CREATE INDEX IF NOT EXISTS idx_matches_state ON matches (state);
