-- ============================================================
-- CONSUMER BEHAVIOR ANALYTICS — COMPLETE DATABASE SCHEMA
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Raw event ingestion table (immutable append-only log)
CREATE TABLE IF NOT EXISTS raw_events (
  id            BIGSERIAL PRIMARY KEY,
  event_id      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_type    VARCHAR(64) NOT NULL,
  session_id    VARCHAR(128) NOT NULL,
  user_id       VARCHAR(128),
  page_url      TEXT,
  page_type     VARCHAR(64),
  referrer      TEXT,
  product_id    VARCHAR(128),
  product_title TEXT,
  product_price NUMERIC(10, 2),
  category      VARCHAR(128),
  quantity      INTEGER,
  search_query  TEXT,
  checkout_step INTEGER,
  properties    JSONB,
  client_ts     TIMESTAMPTZ NOT NULL,
  server_ts     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash       VARCHAR(64),
  user_agent    TEXT,
  device_type   VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_raw_events_session  ON raw_events(session_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_type     ON raw_events(event_type);
CREATE INDEX IF NOT EXISTS idx_raw_events_ts       ON raw_events(server_ts);
CREATE INDEX IF NOT EXISTS idx_raw_events_product  ON raw_events(product_id);

-- Session aggregates
CREATE TABLE IF NOT EXISTS sessions (
  session_id         VARCHAR(128) PRIMARY KEY,
  user_id            VARCHAR(128),
  started_at         TIMESTAMPTZ NOT NULL,
  ended_at           TIMESTAMPTZ,
  duration_seconds   INTEGER,
  event_count        INTEGER DEFAULT 0,
  page_view_count    INTEGER DEFAULT 0,
  product_view_count INTEGER DEFAULT 0,
  search_count       INTEGER DEFAULT 0,
  cart_add_count     INTEGER DEFAULT 0,
  checkout_started   BOOLEAN DEFAULT FALSE,
  checkout_completed BOOLEAN DEFAULT FALSE,
  max_checkout_step  INTEGER DEFAULT 0,
  device_type        VARCHAR(32),
  entry_page         TEXT,
  exit_page          TEXT,
  is_bounce          BOOLEAN DEFAULT FALSE,
  converted          BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_conv    ON sessions(converted);

-- Product-level engagement aggregates
CREATE TABLE IF NOT EXISTS product_analytics (
  product_id               VARCHAR(128) PRIMARY KEY,
  product_title            TEXT,
  category                 VARCHAR(128),
  view_count               INTEGER DEFAULT 0,
  unique_viewers           INTEGER DEFAULT 0,
  cart_add_count           INTEGER DEFAULT 0,
  cart_abandonment_count   INTEGER DEFAULT 0,
  purchase_count           INTEGER DEFAULT 0,
  view_to_cart_rate        NUMERIC(5, 4) DEFAULT 0,
  cart_to_purchase_rate    NUMERIC(5, 4) DEFAULT 0,
  avg_price                NUMERIC(10, 2),
  last_viewed_at           TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Funnel snapshots
CREATE TABLE IF NOT EXISTS funnel_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  step_name     VARCHAR(64) NOT NULL,
  step_order    INTEGER NOT NULL,
  user_count    INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  dropoff_rate  NUMERIC(5, 4) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, step_name)
);

-- User behavioral features (ML-ready)
CREATE TABLE IF NOT EXISTS user_features (
  user_id                VARCHAR(128) PRIMARY KEY,
  session_count          INTEGER DEFAULT 0,
  total_events           INTEGER DEFAULT 0,
  total_page_views       INTEGER DEFAULT 0,
  total_product_views    INTEGER DEFAULT 0,
  total_cart_adds        INTEGER DEFAULT 0,
  total_purchases        INTEGER DEFAULT 0,
  avg_session_duration   NUMERIC(10, 2) DEFAULT 0,
  avg_events_per_session NUMERIC(10, 2) DEFAULT 0,
  days_since_first       INTEGER DEFAULT 0,
  days_since_last        INTEGER DEFAULT 0,
  recency_score          NUMERIC(5, 4) DEFAULT 0,
  frequency_score        NUMERIC(5, 4) DEFAULT 0,
  engagement_score       NUMERIC(5, 4) DEFAULT 0,
  conversion_rate        NUMERIC(5, 4) DEFAULT 0,
  churn_probability      NUMERIC(5, 4) DEFAULT 0,
  engagement_tier        VARCHAR(32),
  churn_risk             VARCHAR(16),
  last_session_at        TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Daily KPI snapshots
CREATE TABLE IF NOT EXISTS daily_kpis (
  id                    BIGSERIAL PRIMARY KEY,
  kpi_date              DATE NOT NULL UNIQUE,
  total_sessions        INTEGER DEFAULT 0,
  unique_users          INTEGER DEFAULT 0,
  new_users             INTEGER DEFAULT 0,
  returning_users       INTEGER DEFAULT 0,
  total_events          INTEGER DEFAULT 0,
  avg_session_duration  NUMERIC(10, 2) DEFAULT 0,
  bounce_rate           NUMERIC(5, 4) DEFAULT 0,
  conversion_rate       NUMERIC(5, 4) DEFAULT 0,
  cart_abandonment_rate NUMERIC(5, 4) DEFAULT 0,
  top_product_id        VARCHAR(128),
  top_product_views     INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Prescriptive recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id               BIGSERIAL PRIMARY KEY,
  rec_id           UUID DEFAULT gen_random_uuid(),
  category         VARCHAR(64) NOT NULL,
  severity         VARCHAR(16) NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  affected_entity  VARCHAR(128),
  metric_value     NUMERIC(10, 4),
  metric_label     VARCHAR(128),
  action_suggested TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  generated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sequence modeling tables ──────────────────────────────────

CREATE TABLE IF NOT EXISTS markov_transitions (
  id               BIGSERIAL PRIMARY KEY,
  from_state       VARCHAR(64) NOT NULL,
  to_state         VARCHAR(64) NOT NULL,
  transition_count INTEGER DEFAULT 0,
  transition_prob  NUMERIC(8, 6) DEFAULT 0,
  conversion_rate  NUMERIC(8, 6) DEFAULT 0,
  abandonment_rate NUMERIC(8, 6) DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_state, to_state)
);

CREATE TABLE IF NOT EXISTS session_sequences (
  session_id        VARCHAR(128) PRIMARY KEY,
  event_sequence    TEXT[] NOT NULL,
  page_sequence     TEXT[] NOT NULL,
  timing_deltas_ms  INTEGER[] NOT NULL,
  sequence_length   INTEGER NOT NULL,
  converted         BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned_at      VARCHAR(64),
  risk_score        NUMERIC(5, 4),
  risk_updated_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seq_converted ON session_sequences(converted);
CREATE INDEX IF NOT EXISTS idx_seq_risk      ON session_sequences(risk_score);

CREATE TABLE IF NOT EXISTS common_paths (
  id               BIGSERIAL PRIMARY KEY,
  path_signature   TEXT NOT NULL UNIQUE,
  path_array       TEXT[] NOT NULL,
  session_count    INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  conversion_rate  NUMERIC(8, 6) DEFAULT 0,
  avg_duration_s   NUMERIC(10, 2) DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_risk_log (
  id             BIGSERIAL PRIMARY KEY,
  session_id     VARCHAR(128) NOT NULL,
  risk_score     NUMERIC(5, 4) NOT NULL,
  risk_tier      VARCHAR(16) NOT NULL,
  sequence_so_far TEXT[] NOT NULL,
  scored_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_log_session ON session_risk_log(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_log_ts      ON session_risk_log(scored_at);

-- ── Contextual decision reconstruction tables ─────────────────

CREATE TABLE IF NOT EXISTS decision_contexts (
  id                          BIGSERIAL PRIMARY KEY,
  event_id                    UUID,
  session_id                  VARCHAR(128) NOT NULL,
  event_type                  VARCHAR(32) NOT NULL,
  product_id                  VARCHAR(128) NOT NULL,
  product_price               NUMERIC(10,2),
  prior_product_views         INTEGER DEFAULT 0,
  prior_cart_adds             INTEGER DEFAULT 0,
  prior_searches              INTEGER DEFAULT 0,
  session_duration_so_far_s   INTEGER DEFAULT 0,
  prices_seen_before          NUMERIC[] DEFAULT '{}',
  median_price_seen           NUMERIC(10,2),
  min_price_seen              NUMERIC(10,2),
  max_price_seen              NUMERIC(10,2),
  price_rank_in_session       INTEGER,
  price_vs_median_pct         NUMERIC(8,2),
  is_most_expensive_seen      BOOLEAN DEFAULT FALSE,
  is_cheapest_seen            BOOLEAN DEFAULT FALSE,
  time_on_page_before_ms      INTEGER DEFAULT 0,
  scroll_depth_pct            INTEGER DEFAULT 0,
  listing_position            INTEGER,
  is_from_search              BOOLEAN DEFAULT FALSE,
  is_return_view              BOOLEAN DEFAULT FALSE,
  same_category_views_before  INTEGER DEFAULT 0,
  different_category_views_before INTEGER DEFAULT 0,
  device_type                 VARCHAR(32),
  hour_of_day                 INTEGER,
  day_of_week                 INTEGER,
  resulted_in_cart_add        BOOLEAN,
  resulted_in_purchase        BOOLEAN,
  client_ts                   TIMESTAMPTZ NOT NULL,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctx_session ON decision_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_ctx_product ON decision_contexts(product_id);
CREATE INDEX IF NOT EXISTS idx_ctx_event   ON decision_contexts(event_type);
CREATE INDEX IF NOT EXISTS idx_ctx_ts      ON decision_contexts(client_ts);

CREATE TABLE IF NOT EXISTS context_conditional_rates (
  id                BIGSERIAL PRIMARY KEY,
  product_id        VARCHAR(128) NOT NULL,
  product_title     TEXT,
  context_dimension VARCHAR(64) NOT NULL,
  bin_label         VARCHAR(64) NOT NULL,
  bin_order         INTEGER DEFAULT 0,
  view_count        INTEGER DEFAULT 0,
  cart_add_count    INTEGER DEFAULT 0,
  conversion_rate   NUMERIC(8,6) DEFAULT 0,
  baseline_rate     NUMERIC(8,6) DEFAULT 0,
  lift              NUMERIC(8,4) DEFAULT 0,
  is_significant    BOOLEAN DEFAULT FALSE,
  p_value           NUMERIC(10,8),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, context_dimension, bin_label)
);

CREATE INDEX IF NOT EXISTS idx_ccr_product ON context_conditional_rates(product_id);
CREATE INDEX IF NOT EXISTS idx_ccr_dim     ON context_conditional_rates(context_dimension);
CREATE INDEX IF NOT EXISTS idx_ccr_sig     ON context_conditional_rates(is_significant);

CREATE TABLE IF NOT EXISTS context_insights (
  id               BIGSERIAL PRIMARY KEY,
  insight_id       UUID DEFAULT gen_random_uuid(),
  product_id       VARCHAR(128),
  product_title    TEXT,
  insight_type     VARCHAR(64) NOT NULL,
  severity         VARCHAR(16) NOT NULL,
  title            TEXT NOT NULL,
  finding          TEXT NOT NULL,
  evidence         TEXT NOT NULL,
  action           TEXT NOT NULL,
  high_context     TEXT,
  low_context      TEXT,
  high_rate        NUMERIC(8,6),
  low_rate         NUMERIC(8,6),
  rate_difference  NUMERIC(8,6),
  relative_lift    NUMERIC(8,4),
  sample_size      INTEGER,
  is_active        BOOLEAN DEFAULT TRUE,
  generated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_product  ON context_insights(product_id);
CREATE INDEX IF NOT EXISTS idx_ci_type     ON context_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ci_severity ON context_insights(severity);

CREATE TABLE IF NOT EXISTS session_context_summary (
  session_id                   VARCHAR(128) PRIMARY KEY,
  avg_prior_views_at_decision  NUMERIC(8,2),
  avg_price_vs_median_pct      NUMERIC(8,2),
  dominant_arrival_mode        VARCHAR(32),
  total_products_viewed        INTEGER,
  unique_categories_viewed     INTEGER,
  avg_scroll_depth_pct         NUMERIC(8,2),
  converted                    BOOLEAN,
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- -- Causal Bandit Intervention System ------------------------
CREATE TABLE IF NOT EXISTS causal_bandit_parameters (
  arm_id         INTEGER PRIMARY KEY,
  arm_name       VARCHAR(64) NOT NULL,
  a_matrix_json  TEXT NOT NULL,
  b_vector_json  TEXT NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intervention_logs (
  id               BIGSERIAL PRIMARY KEY,
  session_id       VARCHAR(128) NOT NULL,
  event_id         UUID,
  context_features JSONB,
  chosen_arm       VARCHAR(64) NOT NULL,
  reward           INTEGER,
  assigned_at      TIMESTAMPTZ DEFAULT NOW(),
  rewarded_at      TIMESTAMPTZ
);

