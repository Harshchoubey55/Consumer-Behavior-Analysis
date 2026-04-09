-- ============================================================
-- DEMO SEED DATA — Realistic behavioral data for testing
-- 800 simulated sessions across 30 days
-- ============================================================

DO $$
DECLARE
  i INTEGER;
  sess_id VARCHAR(128);
  uid VARCHAR(128);
  base_ts TIMESTAMPTZ;
  product_ids TEXT[] := ARRAY[
    'prod_01','prod_02','prod_03','prod_04','prod_05',
    'prod_06','prod_07','prod_08','prod_09','prod_10'
  ];
  product_titles TEXT[] := ARRAY[
    'Classic White Tee','Urban Hoodie','Slim Chinos',
    'Canvas Sneakers','Leather Belt','Wool Scarf',
    'Denim Jacket','Running Shorts','Polo Shirt','Cargo Pants'
  ];
  product_prices NUMERIC[] := ARRAY[
    29.99,79.99,59.99,89.99,34.99,44.99,119.99,39.99,49.99,69.99
  ];
  categories TEXT[] := ARRAY[
    'tops','tops','bottoms','footwear','accessories',
    'accessories','outerwear','activewear','tops','bottoms'
  ];
  dev TEXT;
  rand_device INTEGER;
  rand_funnel FLOAT;
  rand_product INTEGER;
  pid VARCHAR(128);
  ptitle TEXT;
  pprice NUMERIC;
  pcat TEXT;
  evt_ts TIMESTAMPTZ;
  day_offset INTEGER;
BEGIN
  FOR i IN 1..800 LOOP
    sess_id := 'sess_' || md5(random()::text || i::text);
    uid := CASE WHEN random() > 0.3 THEN 'user_' || md5(random()::text) ELSE NULL END;
    day_offset := floor(random() * 30)::INTEGER;
    base_ts := NOW() - (day_offset || ' days')::INTERVAL
               - (floor(random()*18) || ' hours')::INTERVAL;
    rand_device := floor(random()*100)::INTEGER;
    dev := CASE
      WHEN rand_device < 50 THEN 'desktop'
      WHEN rand_device < 90 THEN 'mobile'
      ELSE 'tablet'
    END;

    -- Page view: home
    INSERT INTO raw_events
      (event_type,session_id,user_id,page_url,page_type,device_type,client_ts,server_ts)
    VALUES
      ('page_view',sess_id,uid,'/',  'home',dev,base_ts, base_ts+'1 second'::INTERVAL);

    rand_funnel := random();

    -- ~80% browse listings
    IF rand_funnel > 0.2 THEN
      evt_ts := base_ts + '15 seconds'::INTERVAL;
      INSERT INTO raw_events
        (event_type,session_id,user_id,page_url,page_type,category,device_type,client_ts,server_ts)
      VALUES
        ('page_view',sess_id,uid,'/search','plp',
         categories[floor(random()*10+1)::INTEGER], dev, evt_ts, evt_ts+'1 second'::INTERVAL);

      rand_product := floor(random()*10+1)::INTEGER;
      pid    := product_ids[rand_product];
      ptitle := product_titles[rand_product];
      pprice := product_prices[rand_product];
      pcat   := categories[rand_product];

      -- ~70% view product detail
      IF rand_funnel > 0.3 THEN
        evt_ts := base_ts + '45 seconds'::INTERVAL;
        INSERT INTO raw_events
          (event_type,session_id,user_id,page_url,page_type,
           product_id,product_title,product_price,category,device_type,client_ts,server_ts)
        VALUES
          ('product_view',sess_id,uid,'/product/'||pid,'pdp',
           pid,ptitle,pprice,pcat,dev,evt_ts,evt_ts+'1 second'::INTERVAL);

        -- ~40% add to cart
        IF rand_funnel > 0.6 THEN
          evt_ts := base_ts + '90 seconds'::INTERVAL;
          INSERT INTO raw_events
            (event_type,session_id,user_id,page_url,page_type,
             product_id,product_title,product_price,quantity,device_type,client_ts,server_ts)
          VALUES
            ('add_to_cart',sess_id,uid,'/product/'||pid,'pdp',
             pid,ptitle,pprice,1,dev,evt_ts,evt_ts+'1 second'::INTERVAL);

          -- ~50% view cart
          IF rand_funnel > 0.75 THEN
            evt_ts := base_ts + '110 seconds'::INTERVAL;
            INSERT INTO raw_events
              (event_type,session_id,user_id,page_url,page_type,device_type,client_ts,server_ts)
            VALUES
              ('page_view',sess_id,uid,'/cart','cart',dev,evt_ts,evt_ts+'1 second'::INTERVAL);

            -- ~60% start checkout
            IF rand_funnel > 0.82 THEN
              evt_ts := base_ts + '130 seconds'::INTERVAL;
              INSERT INTO raw_events
                (event_type,session_id,user_id,page_url,page_type,checkout_step,device_type,client_ts,server_ts)
              VALUES
                ('checkout_step',sess_id,uid,'/checkout','checkout',1,dev,evt_ts,evt_ts+'1 second'::INTERVAL);

              IF rand_funnel > 0.88 THEN
                evt_ts := base_ts + '180 seconds'::INTERVAL;
                INSERT INTO raw_events
                  (event_type,session_id,user_id,page_url,page_type,checkout_step,device_type,client_ts,server_ts)
                VALUES
                  ('checkout_step',sess_id,uid,'/checkout','checkout',2,dev,evt_ts,evt_ts+'1 second'::INTERVAL);

                IF rand_funnel > 0.925 THEN
                  evt_ts := base_ts + '240 seconds'::INTERVAL;
                  INSERT INTO raw_events
                    (event_type,session_id,user_id,page_url,page_type,checkout_step,device_type,client_ts,server_ts)
                  VALUES
                    ('checkout_step',sess_id,uid,'/checkout','checkout',3,dev,evt_ts,evt_ts+'1 second'::INTERVAL);

                  IF rand_funnel > 0.955 THEN
                    evt_ts := base_ts + '300 seconds'::INTERVAL;
                    INSERT INTO raw_events
                      (event_type,session_id,user_id,page_url,page_type,
                       product_id,product_price,checkout_step,device_type,client_ts,server_ts)
                    VALUES
                      ('purchase',sess_id,uid,'/checkout/success','checkout',
                       pid,pprice,4,dev,evt_ts,evt_ts+'1 second'::INTERVAL);
                  END IF;
                END IF;
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;

    -- Some sessions include a search
    IF random() > 0.7 THEN
      INSERT INTO raw_events
        (event_type,session_id,user_id,page_url,page_type,search_query,device_type,client_ts,server_ts)
      VALUES
        ('search',sess_id,uid,'/search','search',
         (ARRAY['hoodie','white tee','sneakers','denim','cargo','running'])[floor(random()*6+1)::INTEGER],
         dev, base_ts+'5 seconds'::INTERVAL, base_ts+'6 seconds'::INTERVAL);
    END IF;

  END LOOP;
END $$;

-- ── Build session aggregates ──────────────────────────────────

INSERT INTO sessions (
  session_id, user_id, started_at, ended_at, duration_seconds,
  event_count, page_view_count, product_view_count, search_count,
  cart_add_count, checkout_started, checkout_completed, max_checkout_step,
  device_type, entry_page, exit_page, is_bounce, converted
)
SELECT
  session_id,
  MAX(user_id),
  MIN(client_ts),
  MAX(client_ts),
  GREATEST(EXTRACT(EPOCH FROM (MAX(client_ts) - MIN(client_ts)))::INTEGER, 0),
  COUNT(*),
  COUNT(*) FILTER (WHERE event_type = 'page_view'),
  COUNT(*) FILTER (WHERE event_type = 'product_view'),
  COUNT(*) FILTER (WHERE event_type = 'search'),
  COUNT(*) FILTER (WHERE event_type = 'add_to_cart'),
  BOOL_OR(event_type = 'checkout_step'),
  BOOL_OR(event_type = 'purchase'),
  COALESCE(MAX(checkout_step), 0),
  MAX(device_type),
  (ARRAY_AGG(page_url ORDER BY client_ts ASC))[1],
  (ARRAY_AGG(page_url ORDER BY client_ts DESC))[1],
  COUNT(DISTINCT COALESCE(page_url,'')) <= 1,
  BOOL_OR(event_type = 'purchase')
FROM raw_events
GROUP BY session_id
ON CONFLICT (session_id) DO UPDATE SET
  ended_at          = EXCLUDED.ended_at,
  duration_seconds  = EXCLUDED.duration_seconds,
  event_count       = EXCLUDED.event_count,
  page_view_count   = EXCLUDED.page_view_count,
  product_view_count= EXCLUDED.product_view_count,
  cart_add_count    = EXCLUDED.cart_add_count,
  checkout_started  = EXCLUDED.checkout_started,
  checkout_completed= EXCLUDED.checkout_completed,
  max_checkout_step = EXCLUDED.max_checkout_step,
  converted         = EXCLUDED.converted,
  updated_at        = NOW();

-- ── Build product analytics ───────────────────────────────────

INSERT INTO product_analytics (
  product_id, product_title, category,
  view_count, unique_viewers, cart_add_count, purchase_count,
  avg_price, last_viewed_at
)
SELECT
  product_id,
  MAX(product_title),
  MAX(category),
  COUNT(*) FILTER (WHERE event_type = 'product_view'),
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'product_view'),
  COUNT(*) FILTER (WHERE event_type = 'add_to_cart'),
  COUNT(*) FILTER (WHERE event_type = 'purchase'),
  ROUND(AVG(product_price) FILTER (WHERE product_price IS NOT NULL), 2),
  MAX(client_ts) FILTER (WHERE event_type = 'product_view')
FROM raw_events
WHERE product_id IS NOT NULL
GROUP BY product_id
ON CONFLICT (product_id) DO UPDATE SET
  view_count    = EXCLUDED.view_count,
  unique_viewers= EXCLUDED.unique_viewers,
  cart_add_count= EXCLUDED.cart_add_count,
  purchase_count= EXCLUDED.purchase_count,
  last_viewed_at= EXCLUDED.last_viewed_at,
  updated_at    = NOW();

UPDATE product_analytics SET
  view_to_cart_rate =
    CASE WHEN view_count > 0 THEN ROUND(cart_add_count::NUMERIC / view_count, 4) ELSE 0 END,
  cart_to_purchase_rate =
    CASE WHEN cart_add_count > 0 THEN ROUND(purchase_count::NUMERIC / cart_add_count, 4) ELSE 0 END;

-- ── Funnel snapshot ───────────────────────────────────────────

INSERT INTO funnel_snapshots (snapshot_date, step_name, step_order, session_count, user_count)
SELECT
  CURRENT_DATE, step_name, step_order,
  COUNT(DISTINCT session_id),
  COUNT(DISTINCT COALESCE(user_id, session_id))
FROM (
  SELECT session_id,user_id,'home'            AS step_name,1 AS step_order FROM raw_events WHERE page_type='home'
  UNION ALL
  SELECT session_id,user_id,'product_listing', 2 FROM raw_events WHERE page_type='plp'
  UNION ALL
  SELECT session_id,user_id,'product_detail',  3 FROM raw_events WHERE event_type='product_view'
  UNION ALL
  SELECT session_id,user_id,'add_to_cart',     4 FROM raw_events WHERE event_type='add_to_cart'
  UNION ALL
  SELECT session_id,user_id,'checkout_start',  5 FROM raw_events WHERE event_type='checkout_step' AND checkout_step=1
  UNION ALL
  SELECT session_id,user_id,'purchase',        6 FROM raw_events WHERE event_type='purchase'
) f
GROUP BY step_name, step_order
ON CONFLICT (snapshot_date, step_name) DO UPDATE SET
  session_count = EXCLUDED.session_count,
  user_count    = EXCLUDED.user_count;

-- ── Daily KPIs ────────────────────────────────────────────────

INSERT INTO daily_kpis (
  kpi_date, total_sessions, unique_users,
  total_events, bounce_rate, conversion_rate, cart_abandonment_rate
)
SELECT
  DATE(started_at),
  COUNT(DISTINCT session_id),
  COUNT(DISTINCT COALESCE(user_id, session_id)),
  SUM(event_count),
  ROUND(AVG(CASE WHEN is_bounce THEN 1.0 ELSE 0.0 END), 4),
  ROUND(AVG(CASE WHEN converted THEN 1.0 ELSE 0.0 END), 4),
  ROUND(
    1.0 - SUM(CASE WHEN converted THEN 1.0 ELSE 0.0 END) /
    NULLIF(SUM(CASE WHEN cart_add_count > 0 THEN 1.0 ELSE 0.0 END), 0),
    4
  )
FROM sessions
GROUP BY DATE(started_at)
ON CONFLICT (kpi_date) DO NOTHING;

-- ── Prescriptive recommendations ─────────────────────────────

INSERT INTO recommendations
  (category, severity, title, description, affected_entity, metric_value, metric_label, action_suggested)
SELECT
  'product_issue',
  CASE WHEN view_to_cart_rate < 0.05 THEN 'critical'
       WHEN view_to_cart_rate < 0.12 THEN 'warning' ELSE 'info' END,
  'Low view-to-cart: ' || product_title,
  product_title || ' has ' || view_count || ' views with only ' ||
  ROUND(view_to_cart_rate * 100, 1) || '% add-to-cart rate.',
  product_id,
  view_to_cart_rate,
  'view_to_cart_rate',
  'Improve product imagery, review pricing, add social proof.'
FROM product_analytics
WHERE view_count >= 5 AND view_to_cart_rate < 0.15
ORDER BY view_count DESC
LIMIT 5;
