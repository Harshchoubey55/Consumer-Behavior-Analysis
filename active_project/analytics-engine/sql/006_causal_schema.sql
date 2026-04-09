CREATE TABLE IF NOT EXISTS causal_bandit_parameters (
  id              BIGSERIAL PRIMARY KEY,
  arm_name        VARCHAR(64) NOT NULL UNIQUE,
  theta           NUMERIC[] NOT NULL,
  A_inv           NUMERIC[][] NOT NULL,
  alpha           NUMERIC(5,2) DEFAULT 1.0,
  pulls           INTEGER DEFAULT 0,
  conversions     INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intervention_logs (
  id              BIGSERIAL PRIMARY KEY,
  session_id      VARCHAR(128) NOT NULL,
  event_type      VARCHAR(32),
  context_state   NUMERIC[] NOT NULL,
  assigned_arm    VARCHAR(64) NOT NULL,
  propensity      NUMERIC(5,4),
  outcome         INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intervention_session ON intervention_logs(session_id);
