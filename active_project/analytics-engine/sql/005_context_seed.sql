-- ============================================================
-- SEED DECISION CONTEXTS FROM RAW EVENTS
-- ============================================================
-- Reconstructs decision context for every product_view and
-- add_to_cart event by looking at what happened BEFORE it
-- in the same session. This simulates what the tracker
-- would capture in real-time.
-- ============================================================

-- Step 1: build ordered event log per session
WITH session_events AS (
  SELECT
    e.event_id,
    e.session_id,
    e.event_type,
    e.product_id,
    e.product_title,
    e.product_price,
    e.category,
    e.page_type,
    e.search_query,
    e.client_ts,
    e.device_type,
    -- running counts BEFORE this event in the same session
    COUNT(*) FILTER (WHERE e2.event_type = 'product_view'
      AND e2.client_ts < e.client_ts)
      OVER (PARTITION BY e.session_id ORDER BY e.client_ts ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prior_product_views,
    COUNT(*) FILTER (WHERE e2.event_type = 'add_to_cart'
      AND e2.client_ts < e.client_ts)
      OVER (PARTITION BY e.session_id ORDER BY e.client_ts ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prior_cart_adds,
    COUNT(*) FILTER (WHERE e2.event_type = 'search'
      AND e2.client_ts < e.client_ts)
      OVER (PARTITION BY e.session_id ORDER BY e.client_ts ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prior_searches,
    EXTRACT(EPOCH FROM (e.client_ts - MIN(e.client_ts) OVER (PARTITION BY e.session_id)))::INTEGER AS session_duration_so_far_s,
    EXTRACT(HOUR FROM e.client_ts) AS hour_of_day,
    EXTRACT(DOW FROM e.client_ts) AS day_of_week
  FROM raw_events e
  LEFT JOIN raw_events e2 ON e2.session_id = e.session_id
  WHERE e.event_type IN ('product_view', 'add_to_cart')
    AND e.product_id IS NOT NULL
),

-- Step 2: collect prices seen before each event
prior_prices AS (
  SELECT
    e.event_id,
    ARRAY_AGG(prev.product_price ORDER BY prev.client_ts)
      FILTER (WHERE prev.product_price IS NOT NULL) AS prices_seen,
    COUNT(prev.product_id) FILTER (WHERE prev.category = e.category) AS same_cat_views,
    COUNT(prev.product_id) FILTER (WHERE prev.category != e.category AND prev.category IS NOT NULL) AS diff_cat_views,
    BOOL_OR(prev.event_type = 'search') AS arrived_via_search
  FROM raw_events e
  LEFT JOIN raw_events prev
    ON prev.session_id = e.session_id
    AND prev.event_type = 'product_view'
    AND prev.client_ts < e.client_ts
    AND prev.product_id IS NOT NULL
  WHERE e.event_type IN ('product_view', 'add_to_cart')
    AND e.product_id IS NOT NULL
  GROUP BY e.event_id
),

-- Step 3: session outcomes
session_outcomes AS (
  SELECT
    session_id,
    BOOL_OR(event_type = 'add_to_cart') AS had_cart_add,
    BOOL_OR(event_type = 'purchase') AS had_purchase
  FROM raw_events
  GROUP BY session_id
),

-- Step 4: was this product viewed before in this session?
return_views AS (
  SELECT
    e.event_id,
    COUNT(prev.event_id) > 0 AS is_return_view
  FROM raw_events e
  LEFT JOIN raw_events prev
    ON prev.session_id = e.session_id
    AND prev.event_type = 'product_view'
    AND prev.product_id = e.product_id
    AND prev.client_ts < e.client_ts
  WHERE e.event_type IN ('product_view', 'add_to_cart')
    AND e.product_id IS NOT NULL
  GROUP BY e.event_id
)

INSERT INTO decision_contexts (
  event_id, session_id, event_type, product_id, product_price,
  prior_product_views, prior_cart_adds, prior_searches, session_duration_so_far_s,
  prices_seen_before, median_price_seen, min_price_seen, max_price_seen,
  price_rank_in_session, price_vs_median_pct,
  is_most_expensive_seen, is_cheapest_seen,
  time_on_page_before_ms, scroll_depth_pct,
  is_from_search, is_return_view,
  same_category_views_before, different_category_views_before,
  device_type, hour_of_day, day_of_week,
  resulted_in_cart_add, resulted_in_purchase,
  client_ts
)
SELECT
  se.event_id,
  se.session_id,
  se.event_type,
  se.product_id,
  se.product_price,
  COALESCE(se.prior_product_views, 0),
  COALESCE(se.prior_cart_adds, 0),
  COALESCE(se.prior_searches, 0),
  COALESCE(se.session_duration_so_far_s, 0),

  -- price context
  COALESCE(pp.prices_seen, '{}'),
  CASE WHEN array_length(pp.prices_seen, 1) > 0
    THEN (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v)
      FROM UNNEST(pp.prices_seen) AS v
    )
    ELSE NULL END,
  CASE WHEN array_length(pp.prices_seen, 1) > 0
    THEN (SELECT MIN(v) FROM UNNEST(pp.prices_seen) AS v)
    ELSE NULL END,
  CASE WHEN array_length(pp.prices_seen, 1) > 0
    THEN (SELECT MAX(v) FROM UNNEST(pp.prices_seen) AS v)
    ELSE NULL END,

  -- price rank: how many prior products were cheaper?
  CASE WHEN array_length(pp.prices_seen, 1) > 0
    THEN (SELECT COUNT(*) + 1 FROM UNNEST(pp.prices_seen) AS v WHERE v < se.product_price)
    ELSE 1 END,

  -- % above/below median
  CASE WHEN array_length(pp.prices_seen, 1) > 0
    THEN ROUND(
      (se.product_price - (
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v)
        FROM UNNEST(pp.prices_seen) AS v
      )) /
      NULLIF((
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v)
        FROM UNNEST(pp.prices_seen) AS v
      ), 0) * 100, 2)
    ELSE 0 END,

  -- is this the most expensive / cheapest seen?
  CASE WHEN array_length(pp.prices_seen, 1) > 0
    THEN se.product_price >= (SELECT MAX(v) FROM UNNEST(pp.prices_seen) AS v)
    ELSE FALSE END,
  CASE WHEN array_length(pp.prices_seen, 1) > 0
    THEN se.product_price <= (SELECT MIN(v) FROM UNNEST(pp.prices_seen) AS v)
    ELSE TRUE END,

  -- simulated engagement signals (random but realistic for demo)
  (random() * 30000 + 2000)::INTEGER,   -- 2-32s on page
  (random() * 100)::INTEGER,             -- scroll depth 0-100%

  COALESCE(pp.arrived_via_search, FALSE),
  COALESCE(rv.is_return_view, FALSE),
  COALESCE(pp.same_cat_views, 0),
  COALESCE(pp.diff_cat_views, 0),
  se.device_type,
  se.hour_of_day::INTEGER,
  se.day_of_week::INTEGER,

  -- outcome from session
  COALESCE(so.had_cart_add, FALSE),
  COALESCE(so.had_purchase, FALSE),
  se.client_ts

FROM session_events se
LEFT JOIN prior_prices pp ON pp.event_id = se.event_id
LEFT JOIN session_outcomes so ON so.session_id = se.session_id
LEFT JOIN return_views rv ON rv.event_id = se.event_id
ON CONFLICT DO NOTHING;
