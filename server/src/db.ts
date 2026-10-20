import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Content that the admin edits. Each section exists twice: stage = 'draft' and stage = 'published'. */
export const SINGLETON_TABLES = [
  'website_settings',
  'recipient_settings',
  'birthday_letters',
  'game_settings',
  'exchange_settings',
  'message_settings',
  'gallery_settings',
  'confession_settings',
  'music_settings',
  'theme_settings',
  'fyi_settings',
  'selfie_settings',
] as const;

/** Ordered lists the admin edits. Rows keep the same id across stages so references survive publishing. */
export const LIST_TABLES = [
  'accepted_answers',
  'hints',
  'exchange_missions',
  'gallery_images',
  'music_tracks',
  'fyi_items',
] as const;

export type SingletonTable = (typeof SINGLETON_TABLES)[number];
export type ListTable = (typeof LIST_TABLES)[number];
export type Stage = 'draft' | 'published';

const schema = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  user_agent text,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_ip_time ON login_attempts (ip, created_at DESC);

CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL,
  storage text NOT NULL,
  s3_key text,
  data bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash text,
  invite_id uuid REFERENCES invites(id) ON DELETE SET NULL,
  is_preview boolean NOT NULL DEFAULT false,
  admin_session_id uuid,
  ip text,
  user_agent text,
  device text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  play_started_at timestamptz,
  birthday_passed boolean NOT NULL DEFAULT false,
  birthday_passed_at timestamptz,
  birthday_fails integer NOT NULL DEFAULT 0,
  birthday_locked_until timestamptz,
  letter_opened boolean NOT NULL DEFAULT false,
  letter_read boolean NOT NULL DEFAULT false,
  celebrated boolean NOT NULL DEFAULT false,
  message_sent boolean NOT NULL DEFAULT false,
  gallery_opened boolean NOT NULL DEFAULT false,
  confession_opened boolean NOT NULL DEFAULT false,
  live_consent boolean NOT NULL DEFAULT true,
  tracking_ack boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS visitor_tokens (
  token_hash text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_sessions_device ON visitor_sessions (device_hash) WHERE NOT is_preview;

CREATE TABLE IF NOT EXISTS guessing_sessions (
  session_id uuid PRIMARY KEY REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  started_at timestamptz,
  attempts_used integer NOT NULL DEFAULT 0,
  extra_chances integer NOT NULL DEFAULT 0,
  hint_bonus integer NOT NULL DEFAULT 0,
  special_hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  solved boolean NOT NULL DEFAULT false,
  solved_via text,
  solved_at timestamptz,
  exhausted_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guessing_attempts (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  guess text NOT NULL,
  normalized text NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guessing_attempts_session ON guessing_attempts (session_id, created_at);

CREATE TABLE IF NOT EXISTS exchange_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL,
  mission_title text NOT NULL DEFAULT '',
  submission text NOT NULL DEFAULT '',
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS exchange_requests_session ON exchange_requests (session_id, created_at);

CREATE TABLE IF NOT EXISTS recipient_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  content text NOT NULL,
  char_count integer NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS selfie_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  media_id uuid NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  kind text NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  session_id uuid,
  is_preview boolean NOT NULL DEFAULT false,
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_logs_session ON activity_logs (session_id, id);
CREATE INDEX IF NOT EXISTS activity_logs_actor ON activity_logs (actor, id DESC);
`;

export async function migrate() {
  await pool.query(schema);
  // Idempotent column migrations for databases created by an earlier version.
  await pool.query(`
    ALTER TABLE visitor_sessions ALTER COLUMN live_consent SET DEFAULT true;
    ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS selfie_done boolean NOT NULL DEFAULT false;
    ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS location_asked boolean NOT NULL DEFAULT false;
    ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS geo_lat double precision;
    ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS geo_lng double precision;
    ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS geo_accuracy double precision;
    ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS geo_at timestamptz;
  `);
  for (const t of SINGLETON_TABLES) {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${t} (
      stage text PRIMARY KEY CHECK (stage IN ('draft','published')),
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  }
  for (const t of LIST_TABLES) {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${t} (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      stage text NOT NULL CHECK (stage IN ('draft','published')),
      sort_order integer NOT NULL DEFAULT 0,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id, stage)
    )`);
  }
}
