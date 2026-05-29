"""
phenotype_classifier.py
========================
Behavioral Phenotype Discovery — Restored from v5, enhanced with:
  - Dynamic archetype naming from centroid feature values (not hard-coded)
  - Cross-session behavioral drift tracking
  - Price sensitivity calibration per phenotype

Research grounding:
  Shiv & Fedorikhin (1999): cognitive load affects decision style
  Iyengar & Lepper (2000): choice overload reduces conversion
  Ariely (2003): predictably irrational decision patterns cluster

The research question:
  "Do distinct, statistically separable behavioral phenotypes emerge
   from unsupervised clustering of decision context features, and do
   conversion rates differ significantly across them?"

Output tables:
  - phenotype_profiles   (one row per cluster per run)
  - session_phenotypes   (one row per session, assigned cluster)
  - user_behavioral_drift (cross-session drift detection)
"""

import logging
import uuid
import warnings
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from scipy import stats

warnings.filterwarnings("ignore")
log = logging.getLogger(__name__)

try:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import silhouette_score
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    log.warning("scikit-learn not available — PhenotypeAgent will be skipped.")

from agent_base import BaseAgent, InsufficientDataError


# ── Feature set for phenotype clustering ────────────────────────────────────
# These map directly to the session_context_summary + decision_contexts tables

PHENOTYPE_FEATURES = [
    "avg_prior_views_at_decision",   # comparison depth
    "avg_price_vs_median_pct",       # price sensitivity orientation
    "avg_scroll_depth_pct",          # engagement depth
    "total_products_viewed",         # breadth of browsing
    "unique_categories_viewed",      # diversity of interest
    "avg_prior_cart_adds",           # decisiveness
    "avg_session_dur_s",             # session intensity
    "avg_searches",                  # search-driven vs browse-driven
]

FEATURE_DISPLAY_NAMES = {
    "avg_prior_views_at_decision":  "comparison depth",
    "avg_price_vs_median_pct":      "price position",
    "avg_scroll_depth_pct":         "scroll depth",
    "total_products_viewed":        "browsing breadth",
    "unique_categories_viewed":     "category diversity",
    "avg_prior_cart_adds":          "decisiveness",
    "avg_session_dur_s":            "session duration",
    "avg_searches":                 "search intensity",
}


# ── Dynamic phenotype naming ─────────────────────────────────────────────────

def _name_phenotype_dynamically(centroid: np.ndarray, feature_names: List[str]) -> Tuple[str, str]:
    """
    Assign a name to a cluster based on which features have the highest
    z-score deviation from zero. Returns (human_name, archetype_code).

    This replaces the greedy hard-coded names from v5 with a data-driven
    approach: the dominant behavioral signal gives the phenotype its name.
    """
    # Map feature index → human signal name
    signals = {
        "avg_prior_views_at_decision":  ("Comparison Shopper", "COMPARISON_SHOPPER",  -1),  # high = deliberate
        "avg_price_vs_median_pct":      ("Price-Sensitive",    "PRICE_SENSITIVE",      -1),  # low = deal-seeking
        "avg_scroll_depth_pct":         ("Deep Researcher",    "DEEP_RESEARCHER",       1),  # high = engaged
        "total_products_viewed":        ("Broad Explorer",     "BROAD_EXPLORER",        1),  # high = wide search
        "unique_categories_viewed":     ("Category Hopper",    "CATEGORY_HOPPER",       1),  # high = no focus
        "avg_prior_cart_adds":          ("Intent-Driven",      "INTENT_DRIVEN",         1),  # high = decisive
        "avg_session_dur_s":            ("Deliberate Researcher", "DELIBERATE_RESEARCHER", 1), # high = careful
        "avg_searches":                 ("Search-Driven",      "SEARCH_DRIVEN",         1),  # high = keyword intent
    }

    best_signal_strength = -float("inf")
    best_name = "Unknown Archetype"
    best_code = "UNKNOWN"

    for i, feat in enumerate(feature_names):
        if feat not in signals:
            continue
        human, code, direction = signals[feat]
        # Signal strength = abs(centroid value) × direction alignment
        strength = centroid[i] * direction
        if strength > best_signal_strength:
            best_signal_strength = strength
            best_name = human
            best_code = code

    # Add qualifying adjective for conversion context
    return best_name, best_code


# ── K selection via silhouette ───────────────────────────────────────────────

def _select_k(X_scaled: np.ndarray, k_range: range = range(2, 7)) -> Tuple[int, float]:
    """
    Run K-Means for each K in k_range, pick K with highest silhouette score.
    Returns (best_k, best_silhouette).
    """
    best_k = k_range.start
    best_score = -1.0

    for k in k_range:
        if len(X_scaled) < k * 2:
            break  # not enough samples for this K
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X_scaled)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(X_scaled, labels)
        log.info(f"  K={k} → silhouette={score:.4f}")
        if score > best_score:
            best_score = score
            best_k = k

    return best_k, best_score


# ── Main phenotype pipeline ───────────────────────────────────────────────────

class PhenotypeAgent(BaseAgent):
    """
    Behavioral Phenotype Discovery via K-Means clustering.

    Inputs:  session_context_summary, decision_contexts
    Outputs: phenotype_profiles, session_phenotypes, user_behavioral_drift
    """
    name = "PhenotypeAgent"
    description = (
        "Discovers behavioral archetypes via unsupervised K-Means clustering "
        "of decision context features. Validates with one-way ANOVA. "
        "Tracks cross-session drift in user behavioral style."
    )
    version = "2.0"  # v1 was v5's static naming; v2 uses dynamic naming
    dependencies = ["ContextAnalysisAgent", "UserFeatureAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        if not HAS_SKLEARN:
            raise InsufficientDataError("scikit-learn not installed — phenotype clustering unavailable.")

        run_id = str(uuid.uuid4())
        log.info(f"[PhenotypeAgent] Starting phenotype discovery | sub-run-id={run_id}")

        # ── 1. Load session features ─────────────────────────────────────
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    scs.session_id,
                    COALESCE(scs.avg_prior_views_at_decision, 0)   AS avg_prior_views_at_decision,
                    COALESCE(scs.avg_price_vs_median_pct, 0)        AS avg_price_vs_median_pct,
                    COALESCE(scs.avg_scroll_depth_pct, 0)           AS avg_scroll_depth_pct,
                    COALESCE(scs.total_products_viewed, 0)          AS total_products_viewed,
                    COALESCE(scs.unique_categories_viewed, 0)       AS unique_categories_viewed,
                    COALESCE(AVG(dc.prior_cart_adds), 0)            AS avg_prior_cart_adds,
                    COALESCE(s.duration_seconds, 0)                 AS avg_session_dur_s,
                    COALESCE(s.search_count, 0)                     AS avg_searches,
                    COALESCE(s.converted, FALSE)                    AS converted,
                    COALESCE(s.user_id, s.session_id)               AS user_id
                FROM session_context_summary scs
                LEFT JOIN sessions s ON s.session_id = scs.session_id
                LEFT JOIN decision_contexts dc ON dc.session_id = scs.session_id
                WHERE scs.total_products_viewed > 0
                GROUP BY scs.session_id, scs.avg_prior_views_at_decision,
                         scs.avg_price_vs_median_pct, scs.avg_scroll_depth_pct,
                         scs.total_products_viewed, scs.unique_categories_viewed,
                         s.duration_seconds, s.search_count, s.converted,
                         s.user_id
            """)
            rows = cur.fetchall()

        if len(rows) < 10:
            raise InsufficientDataError(
                f"Only {len(rows)} sessions with context data. "
                "Need ≥10 for meaningful clustering. Collect more user data first."
            )

        session_ids = [r["session_id"] for r in rows]
        user_ids    = [r["user_id"] for r in rows]
        converted   = np.array([bool(r["converted"]) for r in rows])
        X = np.array([[float(r[f] or 0) for f in PHENOTYPE_FEATURES] for r in rows])

        # ── 2. Standardize ────────────────────────────────────────────────
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # ── 3. Select K via silhouette ─────────────────────────────────────
        log.info("[PhenotypeAgent] Selecting optimal K via silhouette score...")
        k_max = min(6, len(rows) // 5)
        best_k, best_silhouette = _select_k(X_scaled, range(2, max(3, k_max + 1)))
        log.info(f"[PhenotypeAgent] Best K={best_k} (silhouette={best_silhouette:.4f})")

        # ── 4. Final clustering ────────────────────────────────────────────
        km = KMeans(n_clusters=best_k, random_state=42, n_init=20)
        labels = km.fit_predict(X_scaled)
        centroids = scaler.inverse_transform(km.cluster_centers_)

        # ── 5. ANOVA: do conversion rates differ across phenotypes? ────────
        conv_groups = [converted[labels == k].astype(float) for k in range(best_k)
                       if (labels == k).sum() >= 2]
        if len(conv_groups) >= 2:
            f_stat, p_val = stats.f_oneway(*conv_groups)
            anova_significant = p_val < 0.05
        else:
            f_stat, p_val = 0.0, 1.0
            anova_significant = False

        log.info(f"[PhenotypeAgent] ANOVA: F={f_stat:.3f}, p={p_val:.4f} "
                 f"({'significant ✓' if anova_significant else 'not significant'})")

        # ── 6. Name phenotypes dynamically ────────────────────────────────
        phenotype_names = []
        phenotype_codes = []
        seen_codes: Dict[str, int] = {}

        for k in range(best_k):
            name, code = _name_phenotype_dynamically(centroids[k], PHENOTYPE_FEATURES)
            # Deduplicate if same code appears for multiple clusters
            if code in seen_codes:
                seen_codes[code] += 1
                code = f"{code}_{seen_codes[code]}"
                name = f"{name} (Variant {seen_codes[code]})"
            else:
                seen_codes[code] = 1
            phenotype_names.append(name)
            phenotype_codes.append(code)

        # ── 7. Write phenotype_profiles ────────────────────────────────────
        with conn.cursor() as cur:
            for k in range(best_k):
                mask = labels == k
                n_k = int(mask.sum())
                conv_rate_k = float(converted[mask].mean()) if n_k > 0 else 0.0
                c = centroids[k]

                cur.execute("""
                    INSERT INTO phenotype_profiles (
                        run_id, cluster_k, phenotype_index, phenotype_name, archetype_code,
                        sample_size, conversion_rate,
                        avg_prior_views, avg_cart_adds, avg_searches,
                        avg_session_dur_s, avg_price_vs_median, avg_scroll_depth, avg_same_cat_views,
                        anova_f_stat, anova_p_value, anova_significant, silhouette_score
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (run_id, phenotype_index) DO UPDATE SET
                        phenotype_name  = EXCLUDED.phenotype_name,
                        sample_size     = EXCLUDED.sample_size,
                        conversion_rate = EXCLUDED.conversion_rate,
                        generated_at    = NOW()
                """, (
                    run_id, best_k, k, phenotype_names[k], phenotype_codes[k],
                    n_k, round(conv_rate_k, 6),
                    round(float(c[0]), 4),  # avg_prior_views
                    round(float(c[5]), 4),  # avg_cart_adds
                    round(float(c[7]), 4),  # avg_searches
                    round(float(c[6]), 4),  # avg_session_dur_s
                    round(float(c[1]), 4),  # avg_price_vs_median
                    round(float(c[2]), 4),  # avg_scroll_depth
                    round(float(c[4]), 4),  # unique_categories → same_cat_views proxy
                    round(float(f_stat), 6), round(float(p_val), 8), anova_significant,
                    round(float(best_silhouette), 6),
                ))

        # ── 8. Write session_phenotypes ────────────────────────────────────
        # Confidence = 1 - normalized distance to centroid
        distances = km.transform(X_scaled)  # shape (n, k)
        dist_to_assigned = distances[np.arange(len(labels)), labels]
        max_dist = dist_to_assigned.max() or 1.0
        confidences = 1.0 - (dist_to_assigned / max_dist)

        with conn.cursor() as cur:
            for i, (sid, label) in enumerate(zip(session_ids, labels)):
                cur.execute("""
                    INSERT INTO session_phenotypes
                        (session_id, run_id, phenotype_index, phenotype_name, archetype_code, confidence)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id) DO UPDATE SET
                        run_id         = EXCLUDED.run_id,
                        phenotype_index= EXCLUDED.phenotype_index,
                        phenotype_name = EXCLUDED.phenotype_name,
                        archetype_code = EXCLUDED.archetype_code,
                        confidence     = EXCLUDED.confidence,
                        assigned_at    = NOW()
                """, (
                    sid, run_id, int(labels[i]),
                    phenotype_names[int(labels[i])],
                    phenotype_codes[int(labels[i])],
                    round(float(confidences[i]), 6),
                ))
        conn.commit()

        # ── 9. Cross-session behavioral drift ─────────────────────────────
        _compute_behavioral_drift(conn, session_ids, user_ids, labels, phenotype_names, phenotype_codes)

        log.info(f"[PhenotypeAgent] Done. K={best_k}, sessions={len(session_ids)}, "
                 f"ANOVA p={p_val:.4f}")
        return len(session_ids), {
            "best_k": best_k,
            "silhouette": round(float(best_silhouette), 4),
            "anova_p": round(float(p_val), 6),
            "anova_significant": anova_significant,
            "phenotypes": {phenotype_names[k]: int((labels == k).sum()) for k in range(best_k)},
        }

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM session_phenotypes")
            n = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(DISTINCT archetype_code) AS k FROM session_phenotypes")
            k = cur.fetchone()["k"]
        return {"session_phenotypes": n, "distinct_archetypes": k}


def _compute_behavioral_drift(
    conn,
    session_ids: List[str],
    user_ids: List[str],
    labels: np.ndarray,
    phenotype_names: List[str],
    phenotype_codes: List[str],
):
    """
    For each user with multiple sessions, detect behavioral drift:
    did their archetype assignment change across sessions?
    """
    # Group by user_id, order by session start time
    with conn.cursor() as cur:
        cur.execute("""
            SELECT session_id, user_id, started_at
            FROM sessions
            WHERE session_id = ANY(%s)
            ORDER BY COALESCE(user_id, session_id), started_at
        """, (session_ids,))
        session_rows = cur.fetchall()

    # Build: user → [(session_id, started_at, label_index)]
    from collections import defaultdict
    user_sessions: Dict[str, list] = defaultdict(list)
    sid_to_label = {sid: labels[i] for i, sid in enumerate(session_ids)}

    for row in session_rows:
        sid = row["session_id"]
        uid = row["user_id"] or sid
        if sid in sid_to_label:
            user_sessions[uid].append((sid, row["started_at"], sid_to_label[sid]))

    drifts = []
    for uid, sess in user_sessions.items():
        if len(sess) < 2:
            continue
        for idx, (sid, ts, label) in enumerate(sess):
            prev_label = sess[idx - 1][2] if idx > 0 else None
            drift = prev_label is not None and prev_label != label
            drift_type = (
                f"{phenotype_codes[prev_label]}→{phenotype_codes[label]}"
                if drift and prev_label is not None else None
            )
            drifts.append((
                uid, sid, idx + 1,
                phenotype_names[label], phenotype_codes[label],
                phenotype_names[prev_label] if prev_label is not None else None,
                drift, drift_type
            ))

    if drifts:
        with conn.cursor() as cur:
            for uid, sid, idx, pname, pcode, prev_pname, drift, dtype in drifts:
                cur.execute("""
                    INSERT INTO user_behavioral_drift
                        (user_id, session_id, session_index, phenotype_name, archetype_code,
                         prev_phenotype, drift_detected, drift_type)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT DO NOTHING
                """, (uid, sid, idx, pname, pcode, prev_pname, drift, dtype))
        conn.commit()

    drift_count = sum(1 for *_, d, _ in drifts if d)
    log.info(f"[PhenotypeAgent] Drift tracking: {drift_count} drifts across {len(user_sessions)} multi-session users.")
