"""
context_analyzer.py
====================
Contextual Decision Reconstruction Engine

The novel contribution: instead of asking "what is the V→C rate for product X?",
we ask "under WHAT DECISION CONTEXT does product X convert well vs. poorly?"

A product that converts at 8% overall might convert at 31% when it's the first
product viewed, but only 3% when viewed after 4+ other products. The aggregate
rate of 8% is true but nearly useless for intervention. The conditional rates
tell you exactly when and why the product struggles.

This module:
  1. Bins each context dimension into meaningful segments
  2. Computes context-conditional conversion rates per product × context bin
  3. Runs chi-squared significance tests to filter noise
  4. Generates plain-language contrastive insights:
       "Product X converts 4.1x better when viewed first vs. after 3+ products,
        suggesting comparison fatigue or unfavorable price anchoring"
  5. Classifies insight types: comparison_fatigue, price_anchor_high,
     price_anchor_low, attention_depth, search_intent, position_bias,
     category_saturation, first_impression, return_viewer

All of this runs on the decision_contexts table populated by the tracker
(or by 005_context_seed.sql for demo data).
"""

import os
import sys
import logging
from collections import defaultdict
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
from scipy import stats

import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/analytics_db")


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ─── Context dimension definitions ─────────────────────────────────────────
# Each dimension: (column_name, bin_function, bin_labels, insight_type_if_significant)

def bin_prior_views(v):
    if v is None or v == 0: return (0, "First product viewed")
    if v == 1: return (1, "2nd product viewed")
    if v <= 3: return (2, "3rd–4th product")
    if v <= 6: return (3, "5th–7th product")
    return (4, "8+ products viewed")

def bin_price_vs_median(v):
    if v is None: return (2, "No prior products")
    if v < -20: return (0, "Cheapest seen (>20% below median)")
    if v < -5:  return (1, "Below median (5–20%)")
    if v < 5:   return (2, "Near median (±5%)")
    if v < 20:  return (3, "Above median (5–20%)")
    return (4, "Most expensive seen (>20% above median)")

def bin_session_duration(v):
    if v is None or v < 30: return (0, "< 30s in session")
    if v < 120: return (1, "30s – 2min")
    if v < 300: return (2, "2 – 5min")
    if v < 600: return (3, "5 – 10min")
    return (4, "10min+ in session")

def bin_scroll_depth(v):
    if v is None or v < 25: return (0, "Shallow scroll (<25%)")
    if v < 50: return (1, "Half page (25–50%)")
    if v < 75: return (2, "Most of page (50–75%)")
    return (3, "Full page (75–100%)")

def bin_time_on_page(v):
    if v is None or v < 3000:  return (0, "< 3s on page")
    if v < 10000: return (1, "3 – 10s")
    if v < 30000: return (2, "10 – 30s")
    return (3, "30s+ on page")

def bin_same_category_views(v):
    if v is None or v == 0: return (0, "First in category")
    if v == 1: return (1, "2nd in category")
    if v <= 3: return (2, "3rd–4th in category")
    return (3, "5+ same-category views")

def bin_hour_of_day(v):
    if v is None: return (2, "Unknown time")
    if 0 <= v < 6:  return (0, "Night (12am–6am)")
    if 6 <= v < 12: return (1, "Morning (6am–12pm)")
    if 12 <= v < 18: return (2, "Afternoon (12–6pm)")
    return (3, "Evening (6pm–12am)")

DIMENSIONS = [
    {
        "name": "prior_product_views",
        "column": "prior_product_views",
        "binner": bin_prior_views,
        "insight_type_high": "first_impression",
        "insight_type_low": "comparison_fatigue",
        "label": "Session depth (products viewed before this)",
        "description": "how many products the user had already viewed before seeing this one",
    },
    {
        "name": "price_vs_median_pct",
        "column": "price_vs_median_pct",
        "binner": bin_price_vs_median,
        "insight_type_high": "price_anchor_low",
        "insight_type_low": "price_anchor_high",
        "label": "Price position vs. session median",
        "description": "how this product's price compared to other products the user had already seen",
    },
    {
        "name": "session_duration_so_far_s",
        "column": "session_duration_so_far_s",
        "binner": bin_session_duration,
        "insight_type_high": "attention_depth",
        "insight_type_low": "attention_depth",
        "label": "Time elapsed in session",
        "description": "how long the user had been browsing before viewing this product",
    },
    {
        "name": "scroll_depth_pct",
        "column": "scroll_depth_pct",
        "binner": bin_scroll_depth,
        "insight_type_high": "attention_depth",
        "insight_type_low": "attention_depth",
        "label": "Scroll depth on product page",
        "description": "how far the user scrolled down the product page",
    },
    {
        "name": "time_on_page_before_ms",
        "column": "time_on_page_before_ms",
        "binner": bin_time_on_page,
        "insight_type_high": "attention_depth",
        "insight_type_low": "attention_depth",
        "label": "Time spent on page",
        "description": "how long the user spent looking at the product before deciding",
    },
    {
        "name": "same_category_views_before",
        "column": "same_category_views_before",
        "binner": bin_same_category_views,
        "insight_type_high": None,
        "insight_type_low": "category_saturation",
        "label": "Same-category products viewed before",
        "description": "how many products in the same category the user had already viewed",
    },
    {
        "name": "hour_of_day",
        "column": "hour_of_day",
        "binner": bin_hour_of_day,
        "insight_type_high": None,
        "insight_type_low": None,
        "label": "Time of day",
        "description": "what time of day the user viewed the product",
    },
]

BINARY_DIMENSIONS = [
    {
        "name": "is_from_search",
        "column": "is_from_search",
        "labels": {True: "Arrived via search", False: "Arrived via browse"},
        "insight_type": "search_intent",
        "label": "Arrival mode (search vs. browse)",
    },
    {
        "name": "is_return_view",
        "column": "is_return_view",
        "labels": {True: "Returning viewer (seen before)", False: "First-time view"},
        "insight_type": "return_viewer",
        "label": "Return viewer",
    },
]


# ─── Chi-squared significance test ─────────────────────────────────────────

def chi_squared_test(conv_a: int, total_a: int, conv_b: int, total_b: int) -> Tuple[float, bool]:
    """
    Test whether conversion rates in two groups are significantly different.
    Returns (p_value, is_significant).
    Minimum sample size: 5 observations per cell.
    """
    if total_a < 5 or total_b < 5:
        return 1.0, False

    obs = np.array([
        [conv_a,         total_a - conv_a],
        [conv_b,         total_b - conv_b],
    ])

    # Avoid all-zero cells
    if obs.sum() == 0 or obs[0].sum() == 0 or obs[1].sum() == 0:
        return 1.0, False

    try:
        _, p_value, _, _ = stats.chi2_contingency(obs, correction=False)
        return float(p_value), p_value < 0.05
    except Exception:
        return 1.0, False


# ─── Main analysis functions ────────────────────────────────────────────────

def load_decision_contexts(conn) -> List[Dict]:
    """Load all decision context rows for product_view events."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                session_id, event_type, product_id, product_price,
                prior_product_views, prior_cart_adds, prior_searches,
                session_duration_so_far_s, prices_seen_before,
                median_price_seen, min_price_seen, max_price_seen,
                price_rank_in_session, price_vs_median_pct,
                is_most_expensive_seen, is_cheapest_seen,
                time_on_page_before_ms, scroll_depth_pct,
                is_from_search, is_return_view,
                same_category_views_before, different_category_views_before,
                device_type, hour_of_day, day_of_week,
                resulted_in_cart_add, resulted_in_purchase,
                client_ts
            FROM decision_contexts
            WHERE event_type = 'product_view'
              AND product_id IS NOT NULL
            ORDER BY client_ts
        """)
        return [dict(r) for r in cur.fetchall()]


def compute_conditional_rates(conn, rows: List[Dict]):
    """
    For each product × context dimension × bin:
    - Count views and cart adds
    - Compute conversion rate
    - Compare to baseline (product's overall rate)
    - Run chi-squared test
    - Write to context_conditional_rates
    """
    log.info(f"Computing conditional rates for {len(rows)} decision contexts...")

    # Group by product
    by_product: Dict[str, List[Dict]] = defaultdict(list)
    for row in rows:
        by_product[row['product_id']].append(row)

    # Get product titles
    product_titles: Dict[str, str] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT product_id, product_title FROM product_analytics")
        for r in cur.fetchall():
            product_titles[r['product_id']] = r['product_title'] or r['product_id']

    records_written = 0

    for product_id, product_rows in by_product.items():
        if len(product_rows) < 8:
            continue  # not enough data for this product

        # Baseline rate for this product
        baseline_views = len(product_rows)
        baseline_carts = sum(1 for r in product_rows if r['resulted_in_cart_add'])
        baseline_rate = baseline_carts / baseline_views if baseline_views > 0 else 0

        # Process each continuous dimension
        for dim in DIMENSIONS:
            col = dim['column']
            # Bin each row
            bin_groups: Dict[Tuple[int, str], List[Dict]] = defaultdict(list)
            for row in product_rows:
                val = row.get(col)
                bin_order, bin_label = dim['binner'](val)
                bin_groups[(bin_order, bin_label)].append(row)

            for (bin_order, bin_label), bin_rows in bin_groups.items():
                if len(bin_rows) < 3:
                    continue

                views = len(bin_rows)
                carts = sum(1 for r in bin_rows if r['resulted_in_cart_add'])
                rate = carts / views if views > 0 else 0
                lift = rate / baseline_rate if baseline_rate > 0 else 1.0

                # Significance vs. baseline
                p_val, is_sig = chi_squared_test(
                    carts, views,
                    baseline_carts - carts, baseline_views - views
                )

                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO context_conditional_rates
                            (product_id, product_title, context_dimension, bin_label, bin_order,
                             view_count, cart_add_count, conversion_rate, baseline_rate,
                             lift, is_significant, p_value)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (product_id, context_dimension, bin_label) DO UPDATE SET
                            view_count      = EXCLUDED.view_count,
                            cart_add_count  = EXCLUDED.cart_add_count,
                            conversion_rate = EXCLUDED.conversion_rate,
                            baseline_rate   = EXCLUDED.baseline_rate,
                            lift            = EXCLUDED.lift,
                            is_significant  = EXCLUDED.is_significant,
                            p_value         = EXCLUDED.p_value,
                            updated_at      = NOW()
                    """, (
                        product_id,
                        product_titles.get(product_id, product_id),
                        dim['name'], bin_label, bin_order,
                        views, carts,
                        round(rate, 6), round(baseline_rate, 6),
                        round(lift, 4), is_sig, round(p_val, 8)
                    ))
                records_written += 1

        # Process binary dimensions
        for bdim in BINARY_DIMENSIONS:
            col = bdim['column']
            for val in [True, False]:
                bin_rows = [r for r in product_rows if r.get(col) == val]
                if len(bin_rows) < 3:
                    continue

                bin_label = bdim['labels'][val]
                views = len(bin_rows)
                carts = sum(1 for r in bin_rows if r['resulted_in_cart_add'])
                rate = carts / views if views > 0 else 0
                lift = rate / baseline_rate if baseline_rate > 0 else 1.0

                complement = [r for r in product_rows if r.get(col) != val]
                comp_views = len(complement)
                comp_carts = sum(1 for r in complement if r['resulted_in_cart_add'])
                p_val, is_sig = chi_squared_test(carts, views, comp_carts, comp_views)

                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO context_conditional_rates
                            (product_id, product_title, context_dimension, bin_label, bin_order,
                             view_count, cart_add_count, conversion_rate, baseline_rate,
                             lift, is_significant, p_value)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (product_id, context_dimension, bin_label) DO UPDATE SET
                            view_count      = EXCLUDED.view_count,
                            cart_add_count  = EXCLUDED.cart_add_count,
                            conversion_rate = EXCLUDED.conversion_rate,
                            baseline_rate   = EXCLUDED.baseline_rate,
                            lift            = EXCLUDED.lift,
                            is_significant  = EXCLUDED.is_significant,
                            p_value         = EXCLUDED.p_value,
                            updated_at      = NOW()
                    """, (
                        product_id,
                        product_titles.get(product_id, product_id),
                        bdim['name'], bin_label,
                        1 if val else 0,
                        views, carts,
                        round(rate, 6), round(baseline_rate, 6),
                        round(lift, 4), is_sig, round(p_val, 8)
                    ))
                records_written += 1

    conn.commit()
    log.info(f"Wrote {records_written} conditional rate records.")


# ─── Contrastive insight generation ────────────────────────────────────────

def _severity(rate_diff: float, relative_lift: float, sample_size: int) -> str:
    """Classify insight severity based on effect size and sample."""
    if sample_size < 20:
        return 'info'
    if abs(relative_lift - 1.0) > 2.0 or abs(rate_diff) > 0.20:
        return 'critical'
    if abs(relative_lift - 1.0) > 0.8 or abs(rate_diff) > 0.08:
        return 'warning'
    return 'info'


def _make_finding(product_title: str, dim_label: str, high_ctx: str, low_ctx: str,
                  high_rate: float, low_rate: float, lift: float, insight_type: str) -> Tuple[str, str, str]:
    """Generate title, finding sentence, and action sentence."""

    hr = f"{high_rate*100:.1f}%"
    lr = f"{low_rate*100:.1f}%"
    lx = f"{lift:.1f}x"

    titles = {
        'comparison_fatigue':   f"Comparison fatigue: {product_title}",
        'first_impression':     f"First-impression advantage: {product_title}",
        'price_anchor_high':    f"Price anchoring hurts: {product_title}",
        'price_anchor_low':     f"Price anchoring helps: {product_title}",
        'attention_depth':      f"Engagement signal: {product_title}",
        'search_intent':        f"Search intent mismatch: {product_title}",
        'category_saturation':  f"Category fatigue: {product_title}",
        'return_viewer':        f"Return-viewer effect: {product_title}",
        'time_of_day':          f"Time-of-day sensitivity: {product_title}",
    }

    findings = {
        'comparison_fatigue':
            f'"{product_title}" converts at {hr} when it\'s among the first products viewed, '
            f'but only {lr} after users have browsed several others — a {lx} difference. '
            f'Users are likely fatigued or anchored to earlier prices by the time they reach this product.',
        'first_impression':
            f'"{product_title}" performs {lx} better ({hr} vs {lr}) when it\'s one of the first '
            f'products viewed in a session. It loses competitiveness as users accumulate alternatives.',
        'price_anchor_high':
            f'"{product_title}" converts at only {lr} when users have seen cheaper products first, '
            f'vs {hr} when it\'s price-competitive with prior views — a {lx} difference. '
            f'Users are anchoring on lower prices seen earlier in the session.',
        'price_anchor_low':
            f'"{product_title}" converts {lx} better ({hr}) when it appears as one of the '
            f'cheaper options relative to what the user has already seen (vs {lr}). '
            f'Price-relative positioning is working in its favour.',
        'attention_depth':
            f'Users who engage more deeply with "{product_title}" — by {high_ctx.lower()} — '
            f'convert at {hr}, compared to {lr} for less engaged users. '
            f'Deeper attention predicts {lx} higher conversion for this product.',
        'search_intent':
            f'"{product_title}" converts at {hr} for users who arrived via search '
            f'but only {lr} for browsers — a {lx} gap. '
            f'Search-intent users have clearer purchase intent when they reach this product.',
        'category_saturation':
            f'"{product_title}" converts at {hr} when it\'s the first product viewed in its category, '
            f'but only {lr} after users have seen several similar items — a {lx} drop. '
            f'Competing within the same category is hurting conversion.',
        'return_viewer':
            f'Users seeing "{product_title}" for the second time in a session convert at {hr}, '
            f'vs {lr} on the first view — a {lx} lift. '
            f'Return viewers have higher intent; re-exposure is working.',
        'time_of_day':
            f'"{product_title}" shows meaningful conversion differences by time of day: '
            f'{high_ctx} sees {hr} vs {lr} at {low_ctx} — a {lx} gap.',
    }

    actions = {
        'comparison_fatigue':
            'Surface this product earlier in recommendation sequences. Consider showing it '
            'as a featured item before users deep-browse, or use it as a session entry point.',
        'first_impression':
            'Prioritise this product for homepage placement and early-session recommendations. '
            'Avoid burying it in long listing pages.',
        'price_anchor_high':
            'Adjust the price, or ensure this product is shown before cheaper alternatives in '
            'the same session. Consider bundling to shift the perceived value anchor.',
        'price_anchor_low':
            'This product benefits from appearing after higher-priced items. Consider its '
            'placement in listing pages and recommendation carousels accordingly.',
        'attention_depth':
            'Invest in content quality for this product — better images, detailed descriptions, '
            'video. Users who engage more deeply convert significantly more.',
        'search_intent':
            'Improve SEO and search result ranking for this product. Ensure product page copy '
            'matches search intent. Consider paid search to capture high-intent traffic.',
        'category_saturation':
            'Reduce in-category competition by differentiating positioning. Emphasise unique '
            'attributes that separate it from similar products the user has already seen.',
        'return_viewer':
            'Add a "Recently viewed" section and retargeting for this product. Users who see '
            'it twice are primed to convert — make the second view easy to trigger.',
        'time_of_day':
            'Consider time-of-day targeted promotions or push notifications. Schedule marketing '
            f'campaigns to align with the high-conversion window: {high_ctx}.',
    }

    t = titles.get(insight_type, f"Context sensitivity: {product_title}")
    f = findings.get(insight_type, f'"{product_title}" shows a {lx} conversion difference between {high_ctx} and {low_ctx}.')
    a = actions.get(insight_type, 'Investigate this context sensitivity and adjust product placement or pricing accordingly.')
    return t, f, a


def generate_context_insights(conn):
    """
    For each significant context effect, generate a plain-language insight.
    Uses contrastive comparison: find the best and worst context bins per
    product × dimension, and generate an insight if the difference is meaningful.
    """
    log.info("Generating context insights...")

    # Clear old insights
    with conn.cursor() as cur:
        cur.execute("UPDATE context_insights SET is_active = FALSE")

    # Load all significant conditional rates
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                product_id, product_title, context_dimension,
                bin_label, bin_order, view_count, cart_add_count,
                conversion_rate, baseline_rate, lift, p_value
            FROM context_conditional_rates
            WHERE view_count >= 5
            ORDER BY product_id, context_dimension, bin_order
        """)
        rows = [dict(r) for r in cur.fetchall()]

    # Build dim_map for lookup
    dim_map = {d['name']: d for d in DIMENSIONS}
    bdim_map = {d['name']: d for d in BINARY_DIMENSIONS}

    # Group by product × dimension
    by_product_dim: Dict[Tuple[str, str], List[Dict]] = defaultdict(list)
    for row in rows:
        by_product_dim[(row['product_id'], row['context_dimension'])].append(row)

    insights_written = 0

    for (product_id, dim_name), dim_rows in by_product_dim.items():
        if len(dim_rows) < 2:
            continue

        # Find best and worst bins
        sorted_rows = sorted(dim_rows, key=lambda r: float(r['conversion_rate']), reverse=True)
        best = sorted_rows[0]
        worst = sorted_rows[-1]

        high_rate = float(best['conversion_rate'])
        low_rate = float(worst['conversion_rate'])
        rate_diff = high_rate - low_rate

        if rate_diff < 0.03:
            continue  # trivial difference, skip

        relative_lift = high_rate / max(low_rate, 0.001)
        sample_size = sum(r['view_count'] for r in dim_rows)

        # Chi-squared between best and worst bins
        p_val, is_sig = chi_squared_test(
            int(best['cart_add_count']), int(best['view_count']),
            int(worst['cart_add_count']), int(worst['view_count'])
        )

        if not is_sig and sample_size < 50:
            continue  # not significant enough

        # Determine insight type
        if dim_name in dim_map:
            dim_def = dim_map[dim_name]
            # Does the best bin come from the "high" or "low" side?
            best_order = int(best['bin_order'])
            worst_order = int(worst['bin_order'])
            if best_order < worst_order:
                # earlier/lower bin is better
                insight_type = dim_def.get('insight_type_high', 'comparison_fatigue')
            else:
                insight_type = dim_def.get('insight_type_low', 'comparison_fatigue')
        elif dim_name in bdim_map:
            insight_type = bdim_map[dim_name]['insight_type']
        else:
            insight_type = 'comparison_fatigue'

        if not insight_type:
            insight_type = 'comparison_fatigue'

        product_title = best.get('product_title') or product_id
        severity = _severity(rate_diff, relative_lift, sample_size)

        title, finding, action = _make_finding(
            product_title,
            dim_map.get(dim_name, bdim_map.get(dim_name, {})).get('label', dim_name),
            best['bin_label'], worst['bin_label'],
            high_rate, low_rate, relative_lift, insight_type
        )

        evidence = (
            f"Based on {sample_size} observations across {len(dim_rows)} context bins. "
            f"Best context '{best['bin_label']}': {high_rate*100:.1f}% conversion ({best['view_count']} views). "
            f"Worst context '{worst['bin_label']}': {low_rate*100:.1f}% conversion ({worst['view_count']} views). "
            f"p-value: {p_val:.4f}."
        )

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO context_insights (
                    product_id, product_title, insight_type, severity,
                    title, finding, evidence, action,
                    high_context, low_context,
                    high_rate, low_rate, rate_difference, relative_lift,
                    sample_size, is_active
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE)
            """, (
                product_id, product_title, insight_type, severity,
                title, finding, evidence, action,
                best['bin_label'], worst['bin_label'],
                round(high_rate, 6), round(low_rate, 6),
                round(rate_diff, 6), round(relative_lift, 4),
                sample_size
            ))
        insights_written += 1

    conn.commit()
    log.info(f"Generated {insights_written} context insights.")
    return insights_written


def build_session_context_summary(conn):
    """Aggregate session-level context profile for portfolio analysis."""
    log.info("Building session context summaries...")
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO session_context_summary (
                session_id, avg_prior_views_at_decision, avg_price_vs_median_pct,
                dominant_arrival_mode, total_products_viewed,
                unique_categories_viewed, avg_scroll_depth_pct, converted
            )
            SELECT
                dc.session_id,
                ROUND(AVG(dc.prior_product_views)::NUMERIC, 2),
                ROUND(AVG(dc.price_vs_median_pct)::NUMERIC, 2),
                CASE
                    WHEN BOOL_OR(dc.is_from_search) THEN 'search'
                    ELSE 'browse'
                END,
                COUNT(DISTINCT dc.product_id),
                COUNT(DISTINCT (
                    SELECT category FROM raw_events re
                    WHERE re.session_id = dc.session_id AND re.product_id = dc.product_id
                    LIMIT 1
                )),
                ROUND(AVG(dc.scroll_depth_pct)::NUMERIC, 1),
                BOOL_OR(dc.resulted_in_purchase)
            FROM decision_contexts dc
            WHERE dc.event_type = 'product_view'
            GROUP BY dc.session_id
            ON CONFLICT (session_id) DO UPDATE SET
                avg_prior_views_at_decision = EXCLUDED.avg_prior_views_at_decision,
                avg_price_vs_median_pct     = EXCLUDED.avg_price_vs_median_pct,
                dominant_arrival_mode       = EXCLUDED.dominant_arrival_mode,
                total_products_viewed       = EXCLUDED.total_products_viewed,
                avg_scroll_depth_pct        = EXCLUDED.avg_scroll_depth_pct,
                converted                   = EXCLUDED.converted,
                updated_at                  = NOW()
        """)
    conn.commit()
    log.info("Session context summaries built.")


def run_context_pipeline(conn):
    """Run the full contextual decision reconstruction pipeline."""
    log.info("Starting context analysis pipeline...")
    rows = load_decision_contexts(conn)
    if not rows:
        log.warning("No decision context data found. Run seed SQL or wait for tracker data.")
        return
    compute_conditional_rates(conn, rows)
    generate_context_insights(conn)
    build_session_context_summary(conn)
    log.info("Context pipeline complete.")
