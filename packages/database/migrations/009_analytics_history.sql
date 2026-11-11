CREATE TABLE IF NOT EXISTS analytics_samples (
 id bigserial UNIQUE, instance_id text NOT NULL, boot_id text NOT NULL, bucket timestamptz NOT NULL,
 observed_at timestamptz NOT NULL, release text NOT NULL, requests_total bigint NOT NULL, errors_total bigint NOT NULL,
 request_rate numeric, error_rate numeric, latency_p95_ms numeric, rss_bytes bigint, cpu_percent numeric,
 queue_waiting integer, queue_active integer, available_slots integer, occupied_slots integer, healthy_workers integer,
 database_healthy boolean, execution_status text NOT NULL, workers jsonb NOT NULL DEFAULT '[]',
 PRIMARY KEY(instance_id,boot_id,bucket)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_samples_time_idx ON analytics_samples(observed_at DESC);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS analytics_usage_buckets (
 instance_id text NOT NULL, boot_id text NOT NULL, bucket timestamptz NOT NULL,
 kind text NOT NULL CHECK(kind IN ('page_view','api_request','run_accepted','submit_accepted')),
 route text NOT NULL, role text NOT NULL, actor_key text NOT NULL, events bigint NOT NULL CHECK(events>=0),
 PRIMARY KEY(instance_id,boot_id,bucket,kind,route,role,actor_key)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_usage_time_idx ON analytics_usage_buckets(bucket DESC);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS analytics_collector_leases (
 name text PRIMARY KEY, owner text NOT NULL, expires_at timestamptz NOT NULL
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS analytics_rule_state (
 scope text NOT NULL, rule text NOT NULL, bad_streak integer NOT NULL, good_streak integer NOT NULL,
 bad_since timestamptz, last_bucket timestamptz NOT NULL, status text NOT NULL,
 PRIMARY KEY(scope,rule)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS analytics_incidents (
 id bigserial PRIMARY KEY, scope text NOT NULL, rule text NOT NULL, severity text NOT NULL,
 message text NOT NULL, opened_at timestamptz NOT NULL, confirmed_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL, resolved_at timestamptz
);
-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS analytics_one_open_incident ON analytics_incidents(scope,rule) WHERE resolved_at IS NULL;
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_incidents_time_idx ON analytics_incidents(confirmed_at DESC);
