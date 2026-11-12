-- Monitoring data only; deliberately no account, source, input, output or grade columns.
CREATE TABLE IF NOT EXISTS analytics_execution_timings (
 event_id uuid PRIMARY KEY,
 job_id varchar(80) NOT NULL,
 attempt integer NOT NULL CHECK (attempt >= 1),
 kind varchar(20) NOT NULL CHECK (kind IN ('dynamic','practice','playground','unknown')),
 language varchar(20) NOT NULL,
 outcome varchar(32) NOT NULL,
 observed_at timestamptz NOT NULL,
 queue_ms double precision CHECK (queue_ms >= 0),
 worker_ms double precision NOT NULL CHECK (worker_ms >= 0),
 prepare_compile_ms double precision CHECK (prepare_compile_ms >= 0),
 execute_ms double precision CHECK (execute_ms >= 0),
 harness_ms double precision CHECK (harness_ms >= 0),
 persist_ms double precision CHECK (persist_ms >= 0),
 cleanup_ms double precision CHECK (cleanup_ms >= 0)
);
CREATE INDEX IF NOT EXISTS analytics_execution_observed_idx ON analytics_execution_timings(observed_at DESC);
