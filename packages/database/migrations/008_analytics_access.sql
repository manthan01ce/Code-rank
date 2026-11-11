-- Analytics is deliberately independent of users, roles and academic credentials.
CREATE TABLE IF NOT EXISTS analytics_sessions (
  token_hash text PRIMARY KEY,
  password_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_session_expiry_idx ON analytics_sessions(expires_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS analytics_login_limits (
  bucket text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS analytics_access (
  id bigserial PRIMARY KEY, action text NOT NULL, detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_access_time_idx ON analytics_access(created_at);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_submission_time_idx ON practical_submissions(submitted_at DESC,id DESC);
