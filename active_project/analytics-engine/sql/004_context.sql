-- ============================================================
-- CONTEXTUAL DECISION RECONSTRUCTION — DATABASE SCHEMA
-- ============================================================
-- 
-- Core idea: capture not just WHAT the user did, but the full
-- situational context at the moment they made the decision.
-- This lets us answer "why" instead of just "what".
--
-- A user who views product X after seeing 5 cheaper products
-- is in a fundamentally different decision context than a user
-- who views product X as their first product. The event is the
-- same. The decision context is completely different.
-- ============================================================

-- Raw decision context snapshots
-- One row per product_view or add_to_cart event
CREATE TABLE IF NOT EXISTS decision_contexts (
  id                    BIGSERIAL PRIMARY KEY,
  event_id              UUID,                    -- links to raw_events.event_id
  session_id            VARCHAR(128) NOT NULL,
  event_type            VARCHAR(32) NOT NULL,     -- product_view | add_to_cart
  product_id            VARCHAR(128) NOT NULL,
  product_price         NUMERIC(10,2),

  -- Prior session context (what happened before this moment)
  prior_product_views   INTEGER DEFAULT 0,        -- how many products seen before this one
  prior_cart_adds       INTEGER DEFAULT 0,        -- how many cart adds before this
  prior_searches        INTEGER DEFAULT 0,        -- searches before this view
  session_duration_so_far_s INTEGER DEFAULT 0,    -- seconds elapsed in session so far

  -- Price anchoring context
  prices_seen_before    NUMERIC[] DEFAULT '{}',   -- prices of all products seen before this one
  median_price_seen     NUMERIC(10,2),            -- median of prior prices
  min_price_seen        NUMERIC(10,2),            -- cheapest product seen before
  max_price_seen        NUMERIC(10,2),            -- most expensive product seen before
  price_rank_in_session INTEGER,                  -- rank of this product by price (1=cheapest seen)
  price_vs_median_pct   NUMERIC(8,2),             -- % above/below median of prior views
  is_most_expensive_seen BOOLEAN DEFAULT FALSE,
  is_cheapest_seen      BOOLEAN DEFAULT FALSE,

  -- Attention & engagement context
  time_on_page_before_ms  INTEGER DEFAULT 0,      -- ms user spent on page before this event
  scroll_depth_pct        INTEGER DEFAULT 0,       -- 0-100, how far they scrolled
  listing_position        INTEGER,                 -- position in search/category listing (if applicable)
  is_from_search          BOOLEAN DEFAULT FALSE,   -- did user come from a search to this product?
  is_return_view          BOOLEAN DEFAULT FALSE,   -- have they viewed this product before this session?

  -- Comparison context
  same_category_views_before INTEGER DEFAULT 0,   -- how many same-category products seen before
  different_category_views_before INTEGER DEFAULT 0,

  -- Device + time context
  device_type           VARCHAR(32),
  hour_of_day           INTEGER,                  -- 0-23
  day_of_week           INTEGER,                  -- 0=Mon, 6=Sun

  -- Outcome (filled in after session ends)
  resulted_in_cart_add  BOOLEAN,                  -- did this view lead to cart add?
  resulted_in_purchase  BOOLEAN,                  -- did this session result in purchase?

  client_ts             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctx_session   ON decision_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_ctx_product   ON decision_contexts(product_id);
CREATE INDEX IF NOT EXISTS idx_ctx_event     ON decision_contexts(event_type);
CREATE INDEX IF NOT EXISTS idx_ctx_ts        ON decision_contexts(client_ts);

-- Context-conditional conversion rates
-- For each product × context dimension × bin, what is the V→C rate?
-- This is the output of the context_analyzer.py processor
CREATE TABLE IF NOT EXISTS context_conditional_rates (
  id                BIGSERIAL PRIMARY KEY,
  product_id        VARCHAR(128) NOT NULL,
  product_title     TEXT,
  context_dimension VARCHAR(64) NOT NULL,   -- e.g. "prior_product_views", "price_vs_median_pct"
  bin_label         VARCHAR(64) NOT NULL,   -- e.g. "0-1 views", "first product", ">20% above median"
  bin_order         INTEGER DEFAULT 0,      -- for display ordering
  view_count        INTEGER DEFAULT 0,
  cart_add_count    INTEGER DEFAULT 0,
  conversion_rate   NUMERIC(8,6) DEFAULT 0,
  baseline_rate     NUMERIC(8,6) DEFAULT 0, -- this product's overall rate (for comparison)
  lift              NUMERIC(8,4) DEFAULT 0, -- conversion_rate / baseline_rate
  is_significant    BOOLEAN DEFAULT FALSE,  -- chi-squared test p < 0.05
  p_value           NUMERIC(10,8),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, context_dimension, bin_label)
);

CREATE INDEX IF NOT EXISTS idx_ccr_product ON context_conditional_rates(product_id);
CREATE INDEX IF NOT EXISTS idx_ccr_dim     ON context_conditional_rates(context_dimension);
CREATE INDEX IF NOT EXISTS idx_ccr_sig     ON context_conditional_rates(is_significant);

-- Context insights: auto-generated plain-language findings
-- These are the "why" layer — contrastive explanations derived from conditional rates
CREATE TABLE IF NOT EXISTS context_insights (
  id                BIGSERIAL PRIMARY KEY,
  insight_id        UUID DEFAULT gen_random_uuid(),
  product_id        VARCHAR(128),
  product_title     TEXT,
  insight_type      VARCHAR(64) NOT NULL,
  -- Types:
  --   comparison_fatigue: converts worse after seeing many products
  --   price_anchor_high:  converts worse when user has seen cheaper products first
  --   price_anchor_low:   converts better when shown as the cheapest option
  --   attention_depth:    converts better when user scrolls deep / spends more time
  --   search_intent:      converts better/worse when user arrived via search
  --   position_bias:      converts differently based on listing position
  --   category_saturation: converts worse after many same-category views
  --   first_impression:   converts much better when it's the first product viewed
  --   return_viewer:      converts differently for users who've seen it before
  severity          VARCHAR(16) NOT NULL,  -- info | warning | critical
  title             TEXT NOT NULL,
  finding           TEXT NOT NULL,         -- plain-language finding
  evidence          TEXT NOT NULL,         -- the specific numbers behind the finding
  action            TEXT NOT NULL,         -- what to do about it
  high_context      TEXT,                  -- the context condition where it over-performs
  low_context       TEXT,                  -- the context condition where it under-performs
  high_rate         NUMERIC(8,6),
  low_rate          NUMERIC(8,6),
  rate_difference   NUMERIC(8,6),          -- absolute difference
  relative_lift     NUMERIC(8,4),          -- high_rate / low_rate
  sample_size       INTEGER,               -- total observations this finding is based on
  is_active         BOOLEAN DEFAULT TRUE,
  generated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_product  ON context_insights(product_id);
CREATE INDEX IF NOT EXISTS idx_ci_type     ON context_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ci_severity ON context_insights(severity);

-- Session context summary (one row per session, computed after session ends)
-- Used for the portfolio view — how context varies across the user base
CREATE TABLE IF NOT EXISTS session_context_summary (
  session_id            VARCHAR(128) PRIMARY KEY,
  avg_prior_views_at_decision NUMERIC(8,2),
  avg_price_vs_median_pct     NUMERIC(8,2),
  dominant_arrival_mode        VARCHAR(32),  -- search | browse | direct
  total_products_viewed        INTEGER,
  unique_categories_viewed     INTEGER,
  avg_scroll_depth_pct         NUMERIC(8,2),
  converted                    BOOLEAN,
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);
