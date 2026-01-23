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
  email text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  region text NOT NULL,
  roles jsonb NOT NULL,
  trust_score integer NOT NULL,
  proxy_level jsonb NOT NULL,
  verification jsonb NOT NULL,
  privacy jsonb NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at bigint;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at bigint;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'proxy_level'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE users
      ALTER COLUMN proxy_level TYPE jsonb
      USING jsonb_build_object('level', proxy_level, 'xp', 0, 'nextXp', 100);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'handle'
  ) THEN
    UPDATE users
    SET email = COALESCE(email, handle || '@interknot.dev')
    WHERE email IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'verified_status'
  ) THEN
    UPDATE users
    SET verification = COALESCE(verification, jsonb_build_object('status', verified_status))
    WHERE verification IS NULL;
  END IF;
END $$;

UPDATE users
SET privacy = COALESCE(privacy, jsonb_build_object('showUidPublicly', false, 'showMatchHistoryPublicly', true))
WHERE privacy IS NULL;

UPDATE users
SET created_at = COALESCE(created_at, CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS bigint))
WHERE created_at IS NULL;

UPDATE users
SET updated_at = COALESCE(updated_at, created_at)
WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS ratings (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  elo integer NOT NULL,
  provisional_matches integer NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (user_id, league_id)
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL
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

CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id text PRIMARY KEY,
  queue_id text NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL,
  match_id text REFERENCES matches(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS player_agent_states (
  uid text NOT NULL,
  region text NOT NULL,
  agent_id text NOT NULL,
  state jsonb NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (uid, region, agent_id)
);

CREATE TABLE IF NOT EXISTS roster_imports (
  uid text NOT NULL,
  region text NOT NULL,
  summary jsonb NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (uid, region)
);

CREATE TABLE IF NOT EXISTS player_import_snapshots (
  snapshot_id text PRIMARY KEY,
  uid text NOT NULL,
  region text NOT NULL,
  fetched_at bigint NOT NULL,
  showcase_agent_ids jsonb NOT NULL,
  raw_enka jsonb,
  ttl_seconds integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_import_snapshots_uid_region
  ON player_import_snapshots (uid, region);
CREATE INDEX IF NOT EXISTS idx_player_import_snapshots_fetched_at
  ON player_import_snapshots (fetched_at);

CREATE INDEX IF NOT EXISTS idx_ratings_league ON ratings (league_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status);
CREATE INDEX IF NOT EXISTS idx_matches_state ON matches (state);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_queue ON matchmaking_queue (queue_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status ON matchmaking_queue (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matchmaking_queue_user_queue ON matchmaking_queue (queue_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
