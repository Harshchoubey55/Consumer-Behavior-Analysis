-- ============================================================
-- SEQUENTIAL BEHAVIORAL MODELING TABLES
-- ============================================================

-- Markov transition matrix: P(next_state | current_state)
-- Built from all observed session sequences
CREATE TABLE IF NOT EXISTS markov_transitions (
  id              BIGSERIAL PRIMARY KEY,
  from_state      VARCHAR(64) NOT NULL,  -- event_type or page_type
  to_state        VARCHAR(64) NOT NULL,
  transition_count INTEGER DEFAULT 0,
  transition_prob  NUMERIC(8, 6) DEFAULT 0,  -- P(to | from)
  -- Breakdown by outcome: what % of sessions that took this transition eventually converted?
  conversion_rate  NUMERIC(8, 6) DEFAULT 0,
  abandonment_rate NUMERIC(8, 6) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_state, to_state)
);

-- Per-session event sequences (ordered, not aggregated)
-- Stored as arrays for efficient sequence modeling
CREATE TABLE IF NOT EXISTS session_sequences (
  session_id          VARCHAR(128) PRIMARY KEY,
  event_sequence      TEXT[] NOT NULL,        -- ordered list of event_types
  page_sequence       TEXT[] NOT NULL,        -- ordered list of page_types
  timing_deltas_ms    INTEGER[] NOT NULL,     -- ms between consecutive events
  sequence_length     INTEGER NOT NULL,
  converted           BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned_at        VARCHAR(64),            -- which state they left from
  risk_score          NUMERIC(5, 4),          -- 0-1, computed by scorer
  risk_updated_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seq_converted ON session_sequences(converted);
CREATE INDEX IF NOT EXISTS idx_seq_risk      ON session_sequences(risk_score);

-- Common paths: top N most frequent event sequences
CREATE TABLE IF NOT EXISTS common_paths (
  id              BIGSERIAL PRIMARY KEY,
  path_signature  TEXT NOT NULL UNIQUE,   -- e.g. "home>plp>pdp>cart>checkout>purchase"
  path_array      TEXT[] NOT NULL,
  session_count   INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  conversion_rate  NUMERIC(8, 6) DEFAULT 0,
  avg_duration_s   NUMERIC(10, 2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- In-session risk score log (append-only for auditing)
CREATE TABLE IF NOT EXISTS session_risk_log (
  id          BIGSERIAL PRIMARY KEY,
  session_id  VARCHAR(128) NOT NULL,
  risk_score  NUMERIC(5, 4) NOT NULL,
  risk_tier   VARCHAR(16) NOT NULL,   -- low | medium | high | critical
  sequence_so_far TEXT[] NOT NULL,
  scored_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_log_session ON session_risk_log(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_log_ts      ON session_risk_log(scored_at);
