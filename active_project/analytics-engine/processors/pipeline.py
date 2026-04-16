"""
pipeline.py
===========
Main analytics pipeline orchestrator.

Runs all processing stages in order:
  1.  Sessionization
  2.  Product analytics
  3.  User feature engineering
  4.  Daily KPIs
  5.  Funnel snapshots
  6.  Prescriptive recommendations
  7.  Session sequence building (for path visualisation only — not predictive)
  8.  Markov transition matrix (descriptive visualisation only)
  9.  Common path extraction
  10. Context conditional rates + insights
  11. Statistical evaluation + model comparison  ← new, runs on --mode=full

Usage:
  python pipeline.py --mode=full          # everything including ML training
  python pipeline.py --mode=incremental   # everything except ML training
"""

import os
import sys
import argparse
import logging
from datetime import datetime

import psycopg2
import psycopg2.extras
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/analytics_db"
)


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ─────────────────────────────────────────────
# 1. SESSIONIZATION
# ─────────────────────────────────────────────

def refresh_sessions(conn):
    log.info("Refreshing sessions...")
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO sessions (
              session_id, user_id, started_at, ended_at, duration_seconds,
              event_count, page_view_count, product_view_count, search_count,
              cart_add_count, checkout_started, checkout_completed,
              max_checkout_step, device_type, entry_page, exit_page,
              is_bounce, converted
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
              ended_at           = EXCLUDED.ended_at,
              duration_seconds   = EXCLUDED.duration_seconds,
              event_count        = EXCLUDED.event_count,
              page_view_count    = EXCLUDED.page_view_count,
              product_view_count = EXCLUDED.product_view_count,
              search_count       = EXCLUDED.search_count,
              cart_add_count     = EXCLUDED.cart_add_count,
              checkout_started   = EXCLUDED.checkout_started,
              checkout_completed = EXCLUDED.checkout_completed,
              max_checkout_step  = EXCLUDED.max_checkout_step,
              converted          = EXCLUDED.converted,
              updated_at         = NOW()
        """)
    conn.commit()
    log.info("Sessions refreshed.")


# ─────────────────────────────────────────────
# 2. PRODUCT ANALYTICS
# ─────────────────────────────────────────────

def refresh_product_analytics(conn):
    log.info("Refreshing product analytics...")
    with conn.cursor() as cur:
        cur.execute("""
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
              view_count     = EXCLUDED.view_count,
              unique_viewers = EXCLUDED.unique_viewers,
              cart_add_count = EXCLUDED.cart_add_count,
              purchase_count = EXCLUDED.purchase_count,
              avg_price      = EXCLUDED.avg_price,
              last_viewed_at = EXCLUDED.last_viewed_at,
              updated_at     = NOW()
        """)
        cur.execute("""
            UPDATE product_analytics SET
              view_to_cart_rate =
                CASE WHEN view_count > 0
                     THEN ROUND(cart_add_count::NUMERIC / view_count, 4)
                     ELSE 0 END,
              cart_to_purchase_rate =
                CASE WHEN cart_add_count > 0
                     THEN ROUND(purchase_count::NUMERIC / cart_add_count, 4)
                     ELSE 0 END
        """)
    conn.commit()
    log.info("Product analytics refreshed.")


# ─────────────────────────────────────────────
# 3. USER FEATURE ENGINEERING
# ─────────────────────────────────────────────

def compute_user_features(conn):
    log.info("Computing user features...")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
              COALESCE(user_id, session_id) AS user_id,
              COUNT(DISTINCT session_id)    AS session_count,
              SUM(event_count)              AS total_events,
              SUM(page_view_count)          AS total_page_views,
              SUM(product_view_count)       AS total_product_views,
              SUM(cart_add_count)           AS total_cart_adds,
              SUM(CASE WHEN converted THEN 1 ELSE 0 END) AS total_purchases,
              ROUND(AVG(duration_seconds)::NUMERIC, 2)   AS avg_session_duration,
              ROUND(AVG(event_count)::NUMERIC, 2)        AS avg_events_per_session,
              EXTRACT(DAY FROM NOW() - MIN(started_at))::INTEGER AS days_since_first,
              EXTRACT(DAY FROM NOW() - MAX(started_at))::INTEGER AS days_since_last,
              MAX(started_at) AS last_session_at
            FROM sessions
            WHERE COALESCE(user_id, session_id) IS NOT NULL
            GROUP BY COALESCE(user_id, session_id)
        """)
        rows = cur.fetchall()

    if not rows:
        log.warning("No session data for user features.")
        return

    for r in rows:
        recency_score    = max(0.0, 1.0 - (r['days_since_last'] or 30) / 30.0)
        frequency_score  = min(1.0, (r['session_count'] or 1) / 10.0)
        engagement_score = min(1.0, (
            (r['total_product_views'] or 0) * 0.3 +
            (r['total_cart_adds'] or 0) * 0.4 +
            (r['total_purchases'] or 0) * 0.3
        ) / max(10, 1))
        conversion_rate  = (r['total_purchases'] or 0) / max(r['session_count'] or 1, 1)
        churn_prob       = min(1.0, (r['days_since_last'] or 0) / 30.0) * (1.0 - engagement_score * 0.5)

        engagement_tier = 'high' if engagement_score > 0.5 else 'medium' if engagement_score > 0.2 else 'low'
        churn_risk      = 'high' if churn_prob > 0.6 else 'medium' if churn_prob > 0.3 else 'low'

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO user_features (
                  user_id, session_count, total_events, total_page_views,
                  total_product_views, total_cart_adds, total_purchases,
                  avg_session_duration, avg_events_per_session,
                  days_since_first, days_since_last,
                  recency_score, frequency_score, engagement_score,
                  conversion_rate, churn_probability,
                  engagement_tier, churn_risk, last_session_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                  session_count          = EXCLUDED.session_count,
                  total_events           = EXCLUDED.total_events,
                  total_product_views    = EXCLUDED.total_product_views,
                  total_cart_adds        = EXCLUDED.total_cart_adds,
                  total_purchases        = EXCLUDED.total_purchases,
                  avg_session_duration   = EXCLUDED.avg_session_duration,
                  recency_score          = EXCLUDED.recency_score,
                  frequency_score        = EXCLUDED.frequency_score,
                  engagement_score       = EXCLUDED.engagement_score,
                  churn_probability      = EXCLUDED.churn_probability,
                  engagement_tier        = EXCLUDED.engagement_tier,
                  churn_risk             = EXCLUDED.churn_risk,
                  last_session_at        = EXCLUDED.last_session_at,
                  updated_at             = NOW()
            """, (
                r['user_id'], r['session_count'], r['total_events'], r['total_page_views'],
                r['total_product_views'], r['total_cart_adds'], r['total_purchases'],
                float(r['avg_session_duration'] or 0), float(r['avg_events_per_session'] or 0),
                r['days_since_first'], r['days_since_last'],
                round(recency_score, 4), round(frequency_score, 4),
                round(engagement_score, 4), round(conversion_rate, 4),
                round(churn_prob, 4), engagement_tier, churn_risk,
                r['last_session_at']
            ))
    conn.commit()
    log.info(f"User features computed for {len(rows)} users.")


# ─────────────────────────────────────────────
# 4. DAILY KPIs
# ─────────────────────────────────────────────

def refresh_daily_kpis(conn):
    log.info("Refreshing daily KPIs...")
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO daily_kpis (
              kpi_date, total_sessions, unique_users,
              total_events, avg_session_duration,
              bounce_rate, conversion_rate, cart_abandonment_rate
            )
            SELECT
              DATE(started_at),
              COUNT(DISTINCT session_id),
              COUNT(DISTINCT COALESCE(user_id, session_id)),
              SUM(event_count),
              ROUND(AVG(duration_seconds)::NUMERIC, 2),
              ROUND(AVG(CASE WHEN is_bounce THEN 1.0 ELSE 0.0 END), 4),
              ROUND(AVG(CASE WHEN converted THEN 1.0 ELSE 0.0 END), 4),
              ROUND(
                1.0 - SUM(CASE WHEN converted THEN 1.0 ELSE 0.0 END) /
                NULLIF(SUM(CASE WHEN cart_add_count > 0 THEN 1.0 ELSE 0.0 END), 0),
                4
              )
            FROM sessions
            GROUP BY DATE(started_at)
            ON CONFLICT (kpi_date) DO UPDATE SET
              total_sessions        = EXCLUDED.total_sessions,
              unique_users          = EXCLUDED.unique_users,
              total_events          = EXCLUDED.total_events,
              avg_session_duration  = EXCLUDED.avg_session_duration,
              bounce_rate           = EXCLUDED.bounce_rate,
              conversion_rate       = EXCLUDED.conversion_rate,
              cart_abandonment_rate = EXCLUDED.cart_abandonment_rate
        """)
    conn.commit()
    log.info("Daily KPIs refreshed.")


# ─────────────────────────────────────────────
# 5. FUNNEL SNAPSHOTS
# ─────────────────────────────────────────────

def refresh_funnel(conn):
    log.info("Refreshing funnel...")
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO funnel_snapshots (snapshot_date, step_name, step_order,
                                          session_count, user_count)
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
              user_count    = EXCLUDED.user_count
        """)
    conn.commit()
    log.info("Funnel refreshed.")


# ─────────────────────────────────────────────
# 6. PRESCRIPTIVE RECOMMENDATIONS
# ─────────────────────────────────────────────

def generate_recommendations(conn):
    log.info("Generating recommendations...")
    with conn.cursor() as cur:
        cur.execute("UPDATE recommendations SET is_active = FALSE")

        cur.execute("""
            INSERT INTO recommendations
              (category, severity, title, description, affected_entity,
               metric_value, metric_label, action_suggested)
            SELECT
              'product_issue',
              CASE WHEN view_to_cart_rate < 0.05 THEN 'critical'
                   WHEN view_to_cart_rate < 0.12  THEN 'warning' ELSE 'info' END,
              'Low view-to-cart: ' || product_title,
              product_title || ' has ' || view_count ||
              ' views with only ' || ROUND(view_to_cart_rate*100,1) || '% add-to-cart rate.',
              product_id, view_to_cart_rate, 'view_to_cart_rate',
              'Improve product imagery, review pricing, add social proof.'
            FROM product_analytics
            WHERE view_count >= 5 AND view_to_cart_rate < 0.15
            ORDER BY view_count DESC
            LIMIT 5
        """)

        cur.execute("""
            INSERT INTO recommendations
              (category, severity, title, description, metric_value, metric_label, action_suggested)
            SELECT
              'engagement','warning',
              'High churn risk segment detected',
              COUNT(*) || ' users show high churn probability (avg ' ||
              ROUND(AVG(churn_probability)*100,1) || '%).',
              ROUND(AVG(churn_probability)::NUMERIC,4),
              'avg_churn_probability',
              'Trigger re-engagement email or personalised discount.'
            FROM user_features
            WHERE churn_risk = 'high'
            HAVING COUNT(*) > 0
        """)

    conn.commit()
    log.info("Recommendations generated.")


# ─────────────────────────────────────────────
# 7-9. SESSION SEQUENCES + MARKOV (DESCRIPTIVE ONLY)
# ─────────────────────────────────────────────

STATE_MAP = {
    "page_view:home":     "HOME",
    "page_view:plp":      "BROWSE",
    "page_view:pdp":      "VIEW_PRODUCT",
    "page_view:cart":     "VIEW_CART",
    "page_view:checkout": "CHECKOUT",
    "product_view":       "VIEW_PRODUCT",
    "add_to_cart":        "ADD_CART",
    "remove_from_cart":   "REMOVE_CART",
    "search":             "SEARCH",
    "checkout_step":      "CHECKOUT",
    "purchase":           "PURCHASE",
}
START_STATE = "__START__"
END_STATE   = "__END__"


def _event_to_state(event_type, page_type=None):
    key = f"{event_type}:{page_type}" if page_type else event_type
    return STATE_MAP.get(key, STATE_MAP.get(event_type, f"OTHER:{event_type}"))


def build_session_sequences(conn):
    """
    Build ordered state sequences per session.
    Used ONLY for the path visualisation dashboard — NOT as a predictive model.
    The Markov matrix produced here shows observed transition frequencies
    (descriptive), not predictions.
    """
    log.info("Building session sequences (descriptive)...")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT session_id,
                   ARRAY_AGG(event_type ORDER BY client_ts) AS event_types,
                   ARRAY_AGG(page_type  ORDER BY client_ts) AS page_types,
                   ARRAY_AGG(client_ts  ORDER BY client_ts) AS timestamps,
                   BOOL_OR(event_type = 'purchase') AS converted
            FROM raw_events
            GROUP BY session_id
            HAVING COUNT(*) >= 2
        """)
        rows = cur.fetchall()

    inserted = 0
    from collections import defaultdict
    transition_counts = defaultdict(lambda: defaultdict(int))
    transition_conv   = defaultdict(lambda: defaultdict(int))

    for row in rows:
        event_types = row['event_types'] or []
        page_types  = row['page_types']  or []
        timestamps  = row['timestamps']  or []
        converted   = row['converted']

        states = []
        for et, pt in zip(event_types, page_types):
            s = _event_to_state(et, pt)
            if not states or states[-1] != s:
                states.append(s)

        if len(states) < 2:
            continue

        deltas = []
        for i in range(1, len(timestamps)):
            if timestamps[i] and timestamps[i-1]:
                deltas.append(max(0, int((timestamps[i] - timestamps[i-1]).total_seconds() * 1000)))
            else:
                deltas.append(0)
        while len(deltas) < len(states):
            deltas.append(0)

        # Build Markov counts
        full_seq = [START_STATE] + states + [END_STATE]
        for i in range(len(full_seq) - 1):
            transition_counts[full_seq[i]][full_seq[i+1]] += 1
            if converted:
                transition_conv[full_seq[i]][full_seq[i+1]] += 1

        with conn.cursor() as cur2:
            cur2.execute("""
                INSERT INTO session_sequences
                    (session_id, event_sequence, page_sequence,
                     timing_deltas_ms, sequence_length, converted, abandoned_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (session_id) DO UPDATE SET
                    event_sequence   = EXCLUDED.event_sequence,
                    sequence_length  = EXCLUDED.sequence_length,
                    converted        = EXCLUDED.converted,
                    abandoned_at     = EXCLUDED.abandoned_at
            """, (
                row['session_id'], states, page_types[:len(states)],
                deltas[:len(states)], len(states), converted,
                None if converted else states[-1],
            ))
        inserted += 1

    conn.commit()

    # Write Markov matrix (descriptive only)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM markov_transitions")
        for from_s, to_counts in transition_counts.items():
            total_from = sum(to_counts.values())
            for to_s, count in to_counts.items():
                prob = count / total_from if total_from > 0 else 0
                conv_rate = transition_conv[from_s][to_s] / count if count > 0 else 0
                cur.execute("""
                    INSERT INTO markov_transitions
                        (from_state, to_state, transition_count, transition_prob, conversion_rate)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (from_state, to_state) DO UPDATE SET
                        transition_count = EXCLUDED.transition_count,
                        transition_prob  = EXCLUDED.transition_prob,
                        conversion_rate  = EXCLUDED.conversion_rate,
                        updated_at       = NOW()
                """, (from_s, to_s, count, round(prob, 6), round(conv_rate, 6)))
    conn.commit()

    # Extract common paths
    from collections import Counter
    with conn.cursor() as cur:
        cur.execute("SELECT event_sequence, converted FROM session_sequences WHERE sequence_length <= 10")
        path_rows = cur.fetchall()

    path_counts = Counter()
    path_conv   = Counter()
    path_arrays = {}
    for r in path_rows:
        seq = r['event_sequence'] or []
        sig = ">".join(seq[:8])
        path_counts[sig] += 1
        path_arrays[sig] = seq[:8]
        if r['converted']:
            path_conv[sig] += 1

    with conn.cursor() as cur:
        cur.execute("DELETE FROM common_paths")
        for sig, count in path_counts.most_common(20):
            conv_rate = path_conv[sig] / count if count > 0 else 0
            cur.execute("""
                INSERT INTO common_paths (path_signature, path_array, session_count,
                                          conversion_count, conversion_rate)
                VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT (path_signature) DO UPDATE SET
                    session_count    = EXCLUDED.session_count,
                    conversion_count = EXCLUDED.conversion_count,
                    conversion_rate  = EXCLUDED.conversion_rate,
                    updated_at       = NOW()
            """, (sig, path_arrays[sig], count, path_conv[sig], round(conv_rate, 6)))
    conn.commit()
    log.info(f"Session sequences built: {inserted} sessions, Markov matrix updated.")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def run_pipeline(mode: str = "incremental"):
    log.info(f"Starting analytics pipeline (mode={mode}) at {datetime.now().isoformat()}...")
    conn = get_conn()
    try:
        refresh_sessions(conn)
        refresh_product_analytics(conn)
        compute_user_features(conn)
        refresh_daily_kpis(conn)
        refresh_funnel(conn)
        generate_recommendations(conn)
        build_session_sequences(conn)

        # Context analysis
        try:
            sys.path.insert(0, os.path.dirname(__file__))
            from context_analyzer import run_context_pipeline
            run_context_pipeline(conn)
        except Exception as e:
            log.warning(f"Context pipeline skipped: {e}")

        # Statistical evaluation (full mode only — needs enough data)
        if mode == "full":
            try:
                from evaluation_engine import run_evaluation_pipeline
                run_evaluation_pipeline(conn)
            except Exception as e:
                log.warning(f"Evaluation pipeline skipped: {e}")

        # Stage 12: Intervention experiment reward backfill
        try:
            from causal_bandit import run_intervention_pipeline
            run_intervention_pipeline(conn)
        except Exception as e:
            log.warning(f"Intervention pipeline skipped: {e}")

        log.info("Pipeline complete.")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="incremental",
                        choices=["incremental", "full"])
    args = parser.parse_args()
    run_pipeline(args.mode)
