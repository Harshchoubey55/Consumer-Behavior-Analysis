-- ============================================================
-- 006 — PHENOTYPES, FEDAVG, ANOMALY DETECTION & AGENT HEALTH
-- ============================================================
-- Covers:
--   A. Behavioral phenotype clustering (restored from v5, dynamic naming)
--   B. Cross-session behavioral drift tracking
--   C. Markov-based session anomaly detection
--   D. FedAvg-inspired federated behavioral phenotyping tables
--   E. Agent health / orchestrator run log

-- ── A. Behavioral Phenotype Clustering ─────────────────────────────────

CREATE TABLE IF NOT EXISTS phenotype_profiles (
  id               BIGSERIAL PRIMARY KEY,
  profile_id       UUID DEFAULT gen_random_uuid(),
  run_id           UUID NOT NULL,
  cluster_k        INTEGER NOT NULL,                -- final K chosen by silhouette
  phenotype_index  INTEGER NOT NULL,                -- 0-based cluster index
  phenotype_name   TEXT NOT NULL,                   -- dynamically assigned
  archetype_code   VARCHAR(32) NOT NULL,            -- e.g. DEAL_SEEKER
  sample_size      INTEGER DEFAULT 0,
  conversion_rate  NUMERIC(8,6) DEFAULT 0,
  -- Centroid feature values (for display + naming)
  avg_prior_views     NUMERIC(8,4) DEFAULT 0,
  avg_cart_adds       NUMERIC(8,4) DEFAULT 0,
  avg_searches        NUMERIC(8,4) DEFAULT 0,
  avg_session_dur_s   NUMERIC(10,2) DEFAULT 0,
  avg_price_vs_median NUMERIC(8,4) DEFAULT 0,
  avg_scroll_depth    NUMERIC(8,4) DEFAULT 0,
  avg_same_cat_views  NUMERIC(8,4) DEFAULT 0,
  anova_f_stat     NUMERIC(12,6),
  anova_p_value    NUMERIC(12,8),
  anova_significant BOOLEAN DEFAULT FALSE,
  silhouette_score  NUMERIC(8,6),
  generated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, phenotype_index)
);

CREATE INDEX IF NOT EXISTS idx_pp_run ON phenotype_profiles(run_id);
CREATE INDEX IF NOT EXISTS idx_pp_archetype ON phenotype_profiles(archetype_code);

CREATE TABLE IF NOT EXISTS session_phenotypes (
  session_id       VARCHAR(128) PRIMARY KEY,
  run_id           UUID NOT NULL,
  phenotype_index  INTEGER NOT NULL,
  phenotype_name   TEXT NOT NULL,
  archetype_code   VARCHAR(32) NOT NULL,
  confidence       NUMERIC(8,6) DEFAULT 0,   -- distance from centroid (normalized)
  assigned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_phenotype ON session_phenotypes(archetype_code);
CREATE INDEX IF NOT EXISTS idx_sp_run       ON session_phenotypes(run_id);

-- ── B. Cross-Session Behavioral Drift ──────────────────────────────────

CREATE TABLE IF NOT EXISTS user_behavioral_drift (
  id               BIGSERIAL PRIMARY KEY,
  user_id          VARCHAR(128) NOT NULL,
  session_id       VARCHAR(128) NOT NULL,
  session_index    INTEGER NOT NULL,          -- 1-based ordinal across user's sessions
  phenotype_name   TEXT NOT NULL,
  archetype_code   VARCHAR(32) NOT NULL,
  prev_phenotype   TEXT,                      -- NULL for first session
  drift_detected   BOOLEAN DEFAULT FALSE,
  drift_type       VARCHAR(64),               -- e.g. 'comparison_shopper→intent_driven'
  recorded_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ubd_user    ON user_behavioral_drift(user_id);
CREATE INDEX IF NOT EXISTS idx_ubd_drift   ON user_behavioral_drift(drift_detected);

-- ── C. Session Anomaly Detection ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_anomalies (
  session_id         VARCHAR(128) PRIMARY KEY,
  sequence_length    INTEGER NOT NULL,
  log_probability    NUMERIC(12,6) NOT NULL,   -- cumulative log-prob of path
  z_score            NUMERIC(8,4) NOT NULL,    -- how many σ below mean
  anomaly_type       VARCHAR(64) NOT NULL,     -- 'improbable_path' | 'loop_heavy' | 'ultra_short'
  path_signature     TEXT NOT NULL,            -- abbreviated state sequence
  converted          BOOLEAN DEFAULT FALSE,
  flagged_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_z_score ON session_anomalies(z_score);
CREATE INDEX IF NOT EXISTS idx_sa_type    ON session_anomalies(anomaly_type);

-- ── D. FedAvg-Inspired Federated Behavioral Phenotyping ───────────────

-- Staging table: receives client gradient deltas (Δw) from the storefront
CREATE TABLE IF NOT EXISTS fedavg_updates (
  id               BIGSERIAL PRIMARY KEY,
  update_id        UUID DEFAULT gen_random_uuid(),
  session_id       VARCHAR(128) NOT NULL,
  n_samples        INTEGER NOT NULL DEFAULT 1,   -- # product views in session
  delta_indices    INTEGER[] NOT NULL,           -- sparse: which dimensions changed
  delta_values     NUMERIC(10,8)[] NOT NULL,     -- sparse: the delta values
  client_ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied          BOOLEAN DEFAULT FALSE,
  applied_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fu_applied ON fedavg_updates(applied);
CREATE INDEX IF NOT EXISTS idx_fu_ts      ON fedavg_updates(client_ts);

-- Global model: single-row table storing current aggregated weights
CREATE TABLE IF NOT EXISTS global_model (
  id               INTEGER PRIMARY KEY DEFAULT 1,  -- always 1
  weights          NUMERIC(10,8)[] NOT NULL,        -- 15-dim weight vector
  n_total_samples  INTEGER DEFAULT 0,               -- cumulative n_samples processed
  n_rounds         INTEGER DEFAULT 0,               -- how many FedAvg rounds run
  last_updated     TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1)   -- enforces single-row
);

-- Insert zero-initialized global model on first run
INSERT INTO global_model (id, weights, n_total_samples, n_rounds)
VALUES (
  1,
  ARRAY[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]::NUMERIC(10,8)[],
  0,
  0
)
ON CONFLICT (id) DO NOTHING;

-- Federated phenotypes: cluster assignments from Δwk space (not raw features)
CREATE TABLE IF NOT EXISTS federated_phenotypes (
  id               BIGSERIAL PRIMARY KEY,
  run_id           UUID NOT NULL,
  session_id       VARCHAR(128) NOT NULL,
  cluster_index    INTEGER NOT NULL,
  cluster_name     TEXT NOT NULL,           -- dynamically named from weight dimensions
  delta_magnitude  NUMERIC(10,6),           -- L2 norm of the Δw vector
  assigned_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_fp_run     ON federated_phenotypes(run_id);
CREATE INDEX IF NOT EXISTS idx_fp_cluster ON federated_phenotypes(cluster_index);

-- ── E. Agent Health & Orchestrator Run Log ─────────────────────────────

-- One row per agent per pipeline run
CREATE TABLE IF NOT EXISTS agent_runs (
  id               BIGSERIAL PRIMARY KEY,
  run_id           UUID NOT NULL,
  pipeline_mode    VARCHAR(32) NOT NULL,   -- 'full' | 'incremental'
  agent_name       VARCHAR(64) NOT NULL,
  agent_version    VARCHAR(16) DEFAULT '1.0',
  status           VARCHAR(16) NOT NULL,   -- PENDING | RUNNING | COMPLETED | FAILED | SKIPPED
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  duration_ms      INTEGER,
  rows_processed   INTEGER,
  error_message    TEXT,
  health_checks    JSONB,                  -- agent's self-reported health metrics
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_run_id     ON agent_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_ar_agent_name ON agent_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_ar_status     ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_ar_created    ON agent_runs(created_at);
