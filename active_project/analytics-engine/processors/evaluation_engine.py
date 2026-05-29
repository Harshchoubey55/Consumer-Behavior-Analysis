"""
evaluation_engine.py
====================
Proper statistical analysis and model evaluation for the
Contextual Decision Reconstruction system.

What this replaces/fixes:
  - Removes Markov chain as a predictive model
  - Adds logistic regression trained on real decision context features
  - Adds Random Forest for comparison (Model A vs Model B)
  - Adds proper train/test split and AUC evaluation
  - Adds regression coefficient table with p-values (statsmodels)
  - Adds feature importance from Random Forest
  - Writes all results to the database for the dashboard to display
  - Adds honest caveats about sample size and generalisability

The core research question this answers:
  "Are price anchoring and comparison fatigue effects detectable and
   statistically significant in natural e-commerce browsing data,
   and do context-aware features outperform count-only features
   for predicting session conversion?"
"""

import os
import sys
import json
import logging
import warnings
from datetime import datetime
from typing import Dict, List, Tuple, Optional

import numpy as np
import psycopg2
import psycopg2.extras
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, classification_report, confusion_matrix,
    precision_recall_curve, average_precision_score
)
from sklearn.inspection import permutation_importance
from scipy import stats
import joblib

# statsmodels for proper p-values on logistic regression coefficients
try:
    import statsmodels.api as sm
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False
    warnings.warn("statsmodels not installed. Install it for proper p-values: pip install statsmodels")

warnings.filterwarnings('ignore')
log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/analytics_db")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODEL_DIR, exist_ok=True)


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ── Table for storing evaluation results ──────────────────────────────────

SETUP_SQL = """
CREATE TABLE IF NOT EXISTS model_evaluation_results (
    id              BIGSERIAL PRIMARY KEY,
    run_id          UUID DEFAULT gen_random_uuid(),
    run_at          TIMESTAMPTZ DEFAULT NOW(),
    model_name      VARCHAR(64) NOT NULL,
    n_train         INTEGER,
    n_test          INTEGER,
    n_total         INTEGER,
    auc_roc         NUMERIC(8,6),
    avg_precision   NUMERIC(8,6),
    accuracy        NUMERIC(8,6),
    cv_auc_mean     NUMERIC(8,6),
    cv_auc_std      NUMERIC(8,6),
    positive_rate   NUMERIC(8,6),
    feature_set     VARCHAR(32),   -- 'context' or 'count_only'
    notes           TEXT,
    is_latest       BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS model_coefficients (
    id              BIGSERIAL PRIMARY KEY,
    run_id          UUID,
    feature_name    VARCHAR(128) NOT NULL,
    coefficient     NUMERIC(10,6),
    std_error       NUMERIC(10,6),
    z_score         NUMERIC(10,4),
    p_value         NUMERIC(12,8),
    odds_ratio      NUMERIC(10,6),
    ci_lower        NUMERIC(10,6),
    ci_upper        NUMERIC(10,6),
    is_significant  BOOLEAN,
    interpretation  TEXT
);

CREATE TABLE IF NOT EXISTS feature_importance (
    id              BIGSERIAL PRIMARY KEY,
    run_id          UUID,
    feature_name    VARCHAR(128) NOT NULL,
    importance      NUMERIC(10,6),
    std_dev         NUMERIC(10,6),
    rank            INTEGER
);

CREATE TABLE IF NOT EXISTS behavioral_effects (
    id              BIGSERIAL PRIMARY KEY,
    effect_name     VARCHAR(128) NOT NULL,
    effect_type     VARCHAR(64),
    description     TEXT,
    coefficient     NUMERIC(10,6),
    p_value         NUMERIC(12,8),
    effect_size     NUMERIC(10,6),
    sample_n        INTEGER,
    is_significant  BOOLEAN,
    direction       VARCHAR(32),   -- positive | negative
    interpretation  TEXT,
    generated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS causal_uplift_results (
    id              BIGSERIAL PRIMARY KEY,
    run_id          UUID DEFAULT gen_random_uuid(),
    run_at          TIMESTAMPTZ DEFAULT NOW(),
    intervention    VARCHAR(64) NOT NULL,
    sample_size     INTEGER,
    base_conversion NUMERIC(8,6),
    treatment_conv  NUMERIC(8,6),
    absolute_uplift NUMERIC(8,6),
    relative_lift   NUMERIC(8,6),
    p_value         NUMERIC(12,8),
    is_significant  BOOLEAN,
    ipw_ate         NUMERIC(8,6),
    notes           TEXT,
    is_latest       BOOLEAN DEFAULT TRUE
);
"""


def setup_tables(conn):
    with conn.cursor() as cur:
        cur.execute(SETUP_SQL)
    conn.commit()


# ── Load training data ────────────────────────────────────────────────────

def load_features(conn) -> Tuple[np.ndarray, np.ndarray, List[str], np.ndarray]:
    """
    Load decision context features and labels from the database.

    Returns:
        X_context: full context feature matrix
        X_count: count-only feature matrix (baseline comparison)
        feature_names: names for context features
        y: binary labels (1=cart_add, 0=view_without_add)
    """
    log.info("Loading decision context features...")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                -- Context features (the novel set)
                COALESCE(prior_product_views, 0)          AS prior_product_views,
                COALESCE(prior_cart_adds, 0)               AS prior_cart_adds,
                COALESCE(prior_searches, 0)                AS prior_searches,
                COALESCE(session_duration_so_far_s, 0)     AS session_duration_s,
                COALESCE(price_vs_median_pct, 0)           AS price_vs_median_pct,
                COALESCE(price_rank_in_session, 1)         AS price_rank_in_session,
                CASE WHEN is_most_expensive_seen THEN 1 ELSE 0 END AS is_most_expensive,
                CASE WHEN is_cheapest_seen       THEN 1 ELSE 0 END AS is_cheapest,
                COALESCE(scroll_depth_pct, 0)              AS scroll_depth_pct,
                COALESCE(time_on_page_before_ms, 0) / 1000.0 AS time_on_page_s,
                CASE WHEN is_from_search  THEN 1 ELSE 0 END AS is_from_search,
                CASE WHEN is_return_view  THEN 1 ELSE 0 END AS is_return_view,
                COALESCE(same_category_views_before, 0)    AS same_category_views,
                COALESCE(hour_of_day, 12)                  AS hour_of_day,
                -- Label
                CASE WHEN resulted_in_cart_add THEN 1 ELSE 0 END AS label
            FROM decision_contexts
            WHERE event_type = 'product_view'
              AND product_id IS NOT NULL
              AND resulted_in_cart_add IS NOT NULL
            ORDER BY client_ts
        """)
        rows = cur.fetchall()

    if len(rows) < 30:
        raise ValueError(
            f"Only {len(rows)} decision context rows found. "
            "Need at least 30 for meaningful analysis. "
            "Run the seed SQL or collect real user data first."
        )

    context_features = [
        'prior_product_views', 'prior_cart_adds', 'prior_searches',
        'session_duration_s', 'price_vs_median_pct', 'price_rank_in_session',
        'is_most_expensive', 'is_cheapest', 'scroll_depth_pct',
        'time_on_page_s', 'is_from_search', 'is_return_view',
        'same_category_views', 'hour_of_day',
    ]

    count_features = [
        'prior_product_views', 'prior_cart_adds', 'prior_searches',
        'session_duration_s',
    ]

    X_context = np.array([[float(r[f] or 0) for f in context_features] for r in rows])
    X_count   = np.array([[float(r[f] or 0) for f in count_features]   for r in rows])
    y = np.array([int(r['label']) for r in rows])

    log.info(
        f"Loaded {len(rows)} observations. "
        f"Positive rate: {y.mean():.1%} ({y.sum()} cart adds, {(1-y).sum()} views without add)"
    )

    return X_context, X_count, context_features, count_features, y


# ── Model A: Count-only baseline ──────────────────────────────────────────

def train_count_baseline(X: np.ndarray, y: np.ndarray, feature_names: List[str], conn) -> Dict:
    """
    Logistic regression on count-only features.
    This is the baseline — equivalent to what standard analytics tools implicitly assume.
    """
    log.info("Training Model A: count-only baseline...")

    if len(y) < 40:
        log.warning("Very small dataset. Results should be treated as indicative only.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if y.sum() >= 4 else None
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    model = LogisticRegression(max_iter=1000, random_state=42, class_weight='balanced')
    model.fit(X_train_s, y_train)

    y_prob = model.predict_proba(X_test_s)[:, 1]
    auc = roc_auc_score(y_test, y_prob) if len(np.unique(y_test)) > 1 else 0.5
    ap  = average_precision_score(y_test, y_prob) if len(np.unique(y_test)) > 1 else y.mean()

    cv = StratifiedKFold(n_splits=min(5, int(y.sum())), shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X_train_s, y_train, cv=cv, scoring='roc_auc')

    result = {
        'model_name': 'LogisticRegression_CountOnly',
        'n_train': len(y_train), 'n_test': len(y_test), 'n_total': len(y),
        'auc_roc': round(float(auc), 6),
        'avg_precision': round(float(ap), 6),
        'accuracy': round(float((model.predict(X_test_s) == y_test).mean()), 6),
        'cv_auc_mean': round(float(cv_scores.mean()), 6),
        'cv_auc_std':  round(float(cv_scores.std()), 6),
        'positive_rate': round(float(y.mean()), 6),
        'feature_set': 'count_only',
        'notes': (
            f'Baseline model using only session count features: '
            f'{", ".join(feature_names)}. '
            f'AUC={auc:.3f}. '
            f'This represents the predictive power available to standard analytics tools.'
        )
    }

    log.info(f"Model A AUC: {auc:.3f} | CV: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
    return result, model, scaler, X_test, y_test, y_prob


# ── Model B: Context-aware model ──────────────────────────────────────────

def train_context_model(
    X: np.ndarray, y: np.ndarray,
    feature_names: List[str], conn
) -> Dict:
    """
    Logistic regression + Random Forest on full context features.
    This is the research contribution — context features should outperform counts.
    Uses statsmodels for proper p-values if available.
    """
    log.info("Training Model B: context-aware logistic regression...")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if y.sum() >= 4 else None
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    # --- Logistic Regression ---
    lr = LogisticRegression(max_iter=1000, random_state=42, class_weight='balanced')
    lr.fit(X_train_s, y_train)

    y_prob_lr = lr.predict_proba(X_test_s)[:, 1]
    auc_lr = roc_auc_score(y_test, y_prob_lr) if len(np.unique(y_test)) > 1 else 0.5
    ap_lr  = average_precision_score(y_test, y_prob_lr) if len(np.unique(y_test)) > 1 else y.mean()

    cv = StratifiedKFold(n_splits=min(5, int(y.sum())), shuffle=True, random_state=42)
    cv_scores = cross_val_score(lr, X_train_s, y_train, cv=cv, scoring='roc_auc')

    result_lr = {
        'model_name': 'LogisticRegression_ContextAware',
        'n_train': len(y_train), 'n_test': len(y_test), 'n_total': len(y),
        'auc_roc': round(float(auc_lr), 6),
        'avg_precision': round(float(ap_lr), 6),
        'accuracy': round(float((lr.predict(X_test_s) == y_test).mean()), 6),
        'cv_auc_mean': round(float(cv_scores.mean()), 6),
        'cv_auc_std':  round(float(cv_scores.std()), 6),
        'positive_rate': round(float(y.mean()), 6),
        'feature_set': 'context',
        'notes': (
            f'Context-aware model using all {len(feature_names)} decision context features. '
            f'AUC={auc_lr:.3f}. '
            f'Compare against count-only baseline to quantify the information gain '
            f'from capturing decision context.'
        )
    }

    # --- Statsmodels for proper p-values ---
    coefficients = []
    if HAS_STATSMODELS:
        try:
            X_sm = sm.add_constant(X_train_s)
            sm_model = sm.Logit(y_train, X_sm)
            sm_result = sm_model.fit(disp=0, maxiter=200)

            conf_int = sm_result.conf_int()
            for i, fname in enumerate(feature_names):
                coef = float(sm_result.params[i + 1])
                se   = float(sm_result.bse[i + 1])
                z    = float(sm_result.tvalues[i + 1])
                pval = float(sm_result.pvalues[i + 1])
                ci_lo = float(conf_int[i + 1][0])
                ci_hi = float(conf_int[i + 1][1])
                odds  = float(np.exp(coef))

                interpretation = _interpret_coefficient(fname, coef, pval, odds)
                coefficients.append({
                    'feature_name': fname,
                    'coefficient': round(coef, 6),
                    'std_error': round(se, 6),
                    'z_score': round(z, 4),
                    'p_value': round(pval, 8),
                    'odds_ratio': round(odds, 6),
                    'ci_lower': round(ci_lo, 6),
                    'ci_upper': round(ci_hi, 6),
                    'is_significant': pval < 0.05,
                    'interpretation': interpretation,
                })
        except Exception as e:
            log.warning(f"statsmodels fitting failed: {e}. Using sklearn coefficients.")

    # Fallback: use sklearn coefficients without p-values
    if not coefficients:
        for i, fname in enumerate(feature_names):
            coef = float(lr.coef_[0][i])
            odds = float(np.exp(coef))
            coefficients.append({
                'feature_name': fname,
                'coefficient': round(coef, 6),
                'std_error': None,
                'z_score': None,
                'p_value': None,
                'odds_ratio': round(odds, 6),
                'ci_lower': None,
                'ci_upper': None,
                'is_significant': None,
                'interpretation': _interpret_coefficient(fname, coef, None, odds),
            })

    log.info(f"Model B (LR) AUC: {auc_lr:.3f}")

    # --- Random Forest ---
    log.info("Training Model B: Random Forest...")
    rf = RandomForestClassifier(
        n_estimators=200, max_depth=6,
        random_state=42, class_weight='balanced', n_jobs=-1
    )
    rf.fit(X_train, y_train)

    y_prob_rf = rf.predict_proba(X_test)[:, 1]
    auc_rf = roc_auc_score(y_test, y_prob_rf) if len(np.unique(y_test)) > 1 else 0.5
    ap_rf  = average_precision_score(y_test, y_prob_rf) if len(np.unique(y_test)) > 1 else y.mean()
    cv_rf  = cross_val_score(rf, X_train, y_train, cv=cv, scoring='roc_auc')

    result_rf = {
        'model_name': 'RandomForest_ContextAware',
        'n_train': len(y_train), 'n_test': len(y_test), 'n_total': len(y),
        'auc_roc': round(float(auc_rf), 6),
        'avg_precision': round(float(ap_rf), 6),
        'accuracy': round(float((rf.predict(X_test) == y_test).mean()), 6),
        'cv_auc_mean': round(float(cv_rf.mean()), 6),
        'cv_auc_std':  round(float(cv_rf.std()), 6),
        'positive_rate': round(float(y.mean()), 6),
        'feature_set': 'context',
        'notes': (
            f'Random Forest on context features. '
            f'AUC={auc_rf:.3f}. Non-linear model for comparison against logistic regression.'
        )
    }
    log.info(f"Model B (RF) AUC: {auc_rf:.3f}")

    # --- Feature importance from RF ---
    fi_result = permutation_importance(rf, X_test, y_test, n_repeats=20, random_state=42)
    feature_importances = []
    for i, fname in enumerate(feature_names):
        feature_importances.append({
            'feature_name': fname,
            'importance': round(float(fi_result.importances_mean[i]), 6),
            'std_dev':    round(float(fi_result.importances_std[i]), 6),
            'rank': 0,
        })
    feature_importances.sort(key=lambda x: x['importance'], reverse=True)
    for rank, fi in enumerate(feature_importances, 1):
        fi['rank'] = rank

    return result_lr, result_rf, coefficients, feature_importances, lr, rf, scaler, X_test, y_test


def _interpret_coefficient(fname: str, coef: float, pval: Optional[float], odds: float) -> str:
    """Generate a plain-language interpretation of a regression coefficient."""
    direction = "increases" if coef > 0 else "decreases"
    sig = ""
    if pval is not None:
        sig = " (statistically significant)" if pval < 0.05 else " (not significant, p>{:.2f})".format(pval)

    interpretations = {
        'price_vs_median_pct': (
            f"For each 1% increase in price above session median, "
            f"the odds of adding to cart {direction} by {abs(odds-1)*100:.1f}%{sig}. "
            f"{'Supports price anchoring hypothesis.' if coef < 0 else 'Unexpected direction — review data.'}"
        ),
        'prior_product_views': (
            f"Each additional product viewed before this one "
            f"{direction} add-to-cart odds by {abs(odds-1)*100:.1f}%{sig}. "
            f"{'Supports comparison fatigue hypothesis.' if coef < 0 else 'More browsing correlates with higher intent.'}"
        ),
        'scroll_depth_pct': (
            f"Each percentage point increase in scroll depth "
            f"{direction} add-to-cart odds by {abs(odds-1)*100:.1f}%{sig}. "
            f"Deeper engagement with product page {'predicts higher' if coef > 0 else 'surprisingly predicts lower'} conversion."
        ),
        'time_on_page_s': (
            f"Each additional second on the product page "
            f"{direction} add-to-cart odds by {abs(odds-1)*100:.1f}%{sig}. "
            f"{'Longer attention predicts conversion.' if coef > 0 else 'Hesitation may indicate uncertainty.'}"
        ),
        'is_from_search': (
            f"Arriving via search {'increases' if coef > 0 else 'decreases'} add-to-cart odds "
            f"by {abs(odds-1)*100:.1f}% compared to browsing{sig}. "
            f"Search intent {'correlates with higher' if coef > 0 else 'surprisingly correlates with lower'} purchase intent."
        ),
        'is_return_view': (
            f"Viewing a product for the second time "
            f"{'increases' if coef > 0 else 'decreases'} add-to-cart odds "
            f"by {abs(odds-1)*100:.1f}%{sig}."
        ),
        'same_category_views': (
            f"Each additional same-category product viewed before "
            f"{direction} add-to-cart odds by {abs(odds-1)*100:.1f}%{sig}. "
            f"{'Category saturation detected.' if coef < 0 else 'Category exploration may prime purchase intent.'}"
        ),
        'is_cheapest': (
            f"Being the cheapest product seen so far "
            f"{'increases' if coef > 0 else 'decreases'} add-to-cart odds "
            f"by {abs(odds-1)*100:.1f}%{sig}. "
            f"{'Price anchor advantage.' if coef > 0 else 'Cheapest option may signal quality concerns.'}"
        ),
        'is_most_expensive': (
            f"Being the most expensive product seen so far "
            f"{'increases' if coef > 0 else 'decreases'} add-to-cart odds "
            f"by {abs(odds-1)*100:.1f}%{sig}. "
            f"{'Premium positioning effective.' if coef > 0 else 'Supports price anchoring — expensive vs prior views hurts conversion.'}"
        ),
    }
    return interpretations.get(
        fname,
        f"Feature {fname}: coefficient={coef:.3f}, odds ratio={odds:.3f}{sig}."
    )


# ── Behavioral effects analysis ───────────────────────────────────────────

def analyze_behavioral_effects(conn, X: np.ndarray, y: np.ndarray, feature_names: List[str]) -> List[Dict]:
    """
    Test specific behavioral economics hypotheses directly.
    Each effect is tested independently using the appropriate statistical test.
    This produces results you can present as "findings" regardless of model performance.
    """
    log.info("Analysing behavioral economics effects...")
    effects = []
    fn_idx = {f: i for i, f in enumerate(feature_names)}

    # ── Effect 1: Price anchoring ──────────────────────────────────────
    # Hypothesis: P(add_to_cart) is lower when price_vs_median_pct is high
    if 'price_vs_median_pct' in fn_idx:
        pvm = X[:, fn_idx['price_vs_median_pct']]
        # Split at median
        median_split = np.median(pvm)
        below = y[pvm <= median_split]
        above = y[pvm > median_split]

        if len(below) >= 5 and len(above) >= 5:
            # Point-biserial correlation
            corr, pval = stats.pointbiserialr(pvm, y)
            # t-test on rates
            _, ttest_p = stats.ttest_ind(below, above)

            effects.append({
                'effect_name': 'Price Anchoring',
                'effect_type': 'price_anchoring',
                'description': (
                    'Products priced above the session median convert at a lower rate '
                    'than products at or below the median. Tests the behavioral economics '
                    'prediction that prior price exposure creates a reference point '
                    'against which subsequent prices are evaluated.'
                ),
                'coefficient': round(float(corr), 6),
                'p_value': round(float(pval), 8),
                'effect_size': round(float(corr), 6),
                'sample_n': len(y),
                'is_significant': pval < 0.05,
                'direction': 'negative' if corr < 0 else 'positive',
                'interpretation': (
                    f"Point-biserial correlation between price position and conversion: "
                    f"r={corr:.3f}, p={pval:.4f}. "
                    f"Below-median price group conversion rate: {below.mean():.1%}. "
                    f"Above-median price group conversion rate: {above.mean():.1%}. "
                    f"Difference: {(below.mean()-above.mean())*100:.1f} percentage points. "
                    f"{'Effect is statistically significant.' if pval < 0.05 else 'Effect not significant at p<0.05 — may need larger sample.'}"
                ),
            })

    # ── Effect 2: Comparison fatigue ──────────────────────────────────
    if 'prior_product_views' in fn_idx:
        ppv = X[:, fn_idx['prior_product_views']]
        corr, pval = stats.pointbiserialr(ppv, y)

        # Conversion rate by depth bucket
        buckets = [(0,0,'First'), (1,2,'2nd–3rd'), (3,5,'4th–6th'), (6,100,'7th+')]
        bucket_rates = {}
        for lo, hi, label in buckets:
            mask = (ppv >= lo) & (ppv <= hi)
            if mask.sum() >= 3:
                bucket_rates[label] = (float(y[mask].mean()), int(mask.sum()))

        effects.append({
            'effect_name': 'Comparison Fatigue',
            'effect_type': 'comparison_fatigue',
            'description': (
                'Conversion probability decreases as the number of products '
                'viewed before the current product increases. Tests the hypothesis '
                'that decision fatigue and accumulating alternatives reduce '
                'purchase intent over the course of a session.'
            ),
            'coefficient': round(float(corr), 6),
            'p_value': round(float(pval), 8),
            'effect_size': round(float(corr), 6),
            'sample_n': len(y),
            'is_significant': pval < 0.05,
            'direction': 'negative' if corr < 0 else 'positive',
            'interpretation': (
                f"Correlation between session depth and conversion: r={corr:.3f}, p={pval:.4f}. "
                + " | ".join([f"{k}: {v[0]:.1%} ({v[1]} obs)" for k, v in bucket_rates.items()])
                + f". {'Significant comparison fatigue detected.' if pval < 0.05 and corr < 0 else 'Effect weak or not significant.'}"
            ),
        })

    # ── Effect 3: Attention depth ──────────────────────────────────────
    if 'scroll_depth_pct' in fn_idx and 'time_on_page_s' in fn_idx:
        scroll = X[:, fn_idx['scroll_depth_pct']]
        time_s = X[:, fn_idx['time_on_page_s']]
        # Composite attention score
        attention = (scroll / 100.0) * np.log1p(time_s)
        corr, pval = stats.pointbiserialr(attention, y)

        effects.append({
            'effect_name': 'Attention Depth',
            'effect_type': 'attention_depth',
            'description': (
                'Users who scroll further and spend more time on a product page '
                'convert at higher rates. Tests whether observable engagement signals '
                'predict purchase intent.'
            ),
            'coefficient': round(float(corr), 6),
            'p_value': round(float(pval), 8),
            'effect_size': round(float(corr), 6),
            'sample_n': len(y),
            'is_significant': pval < 0.05,
            'direction': 'positive' if corr > 0 else 'negative',
            'interpretation': (
                f"Composite attention score (scroll × log(dwell)) vs conversion: "
                f"r={corr:.3f}, p={pval:.4f}. "
                f"{'Deeper engagement predicts conversion significantly.' if pval < 0.05 and corr > 0 else 'Attention-conversion relationship weak in this sample.'}"
            ),
        })

    # ── Effect 4: Search intent ────────────────────────────────────────
    if 'is_from_search' in fn_idx:
        search_flag = X[:, fn_idx['is_from_search']].astype(bool)
        search_conv = y[search_flag].mean() if search_flag.sum() >= 3 else None
        browse_conv = y[~search_flag].mean() if (~search_flag).sum() >= 3 else None

        if search_conv is not None and browse_conv is not None:
            _, pval = stats.fisher_exact([
                [y[search_flag].sum(),  search_flag.sum()  - y[search_flag].sum()],
                [y[~search_flag].sum(), (~search_flag).sum() - y[~search_flag].sum()],
            ])
            effect_size = search_conv - browse_conv

            effects.append({
                'effect_name': 'Search Intent Premium',
                'effect_type': 'search_intent',
                'description': (
                    'Users arriving at a product via search convert at a different '
                    'rate than those who browsed to it. Tests whether search intent '
                    'signals higher purchase readiness.'
                ),
                'coefficient': round(float(effect_size), 6),
                'p_value': round(float(pval), 8),
                'effect_size': round(float(effect_size), 6),
                'sample_n': len(y),
                'is_significant': pval < 0.05,
                'direction': 'positive' if effect_size > 0 else 'negative',
                'interpretation': (
                    f"Search arrival conversion: {search_conv:.1%} ({search_flag.sum()} obs). "
                    f"Browse arrival conversion: {browse_conv:.1%} ({(~search_flag).sum()} obs). "
                    f"Difference: {effect_size*100:+.1f}pp. Fisher's exact p={pval:.4f}. "
                    f"{'Search intent significantly predicts higher conversion.' if pval < 0.05 and effect_size > 0 else 'Effect not significant or unexpected direction.'}"
                ),
            })

    log.info(f"Analysed {len(effects)} behavioral effects.")
    return effects

# ── Causal Uplift Analysis ────────────────────────────────────────────────

def evaluate_causal_uplift(conn) -> List[Dict]:
    """
    Evaluates the causal uplift generated by the randomized intervention experiment.
    Uses Inverse Probability Weighting (IPW) to calculate the Average Treatment Effect (ATE).
    
    Because we use FIXED propensity scores (50/25/25), this IPW estimator is
    mathematically valid — unlike with an adaptive bandit where propensities change.
    """
    log.info("Evaluating Causal Uplift from Randomized Interventions...")
    
    with conn.cursor() as cur:
        # Fetch all intervention logs with known outcomes
        cur.execute("""
             SELECT assigned_arm, outcome, propensity
             FROM intervention_logs
             WHERE outcome_updated = TRUE
               AND propensity > 0 AND propensity < 1
        """)
        logs = cur.fetchall()

    if not logs or len(logs) < 5:
        log.warning(f"Only {len(logs) if logs else 0} intervention logs with outcomes. Need >= 5 for causal uplift. Skipping.")
        return []

    results = []
    
    # Get unique treatment arms (exclude NONE which is the control)
    arms = list(set([r['assigned_arm'] for r in logs if r['assigned_arm'] != 'NONE']))
    
    for arm in arms:
        # Treatment mask
        t_mask = np.array([r['assigned_arm'] == arm for r in logs])
        # Control mask
        c_mask = np.array([r['assigned_arm'] == 'NONE' for r in logs])
        
        if t_mask.sum() < 3 or c_mask.sum() < 3:
            log.info(f"Arm {arm}: insufficient data (treatment={t_mask.sum()}, control={c_mask.sum()})")
            continue
            
        y = np.array([r['outcome'] for r in logs])
        propensities = np.array([float(r['propensity']) for r in logs])
        
        # Simple comparison
        base_conv = y[c_mask].mean()
        treat_conv = y[t_mask].mean()
        
        # IPW estimator for Average Treatment Effect (ATE)
        # E[Y(1)] = E[Y * I(T=1) / P(T=1|X)]   (treatment)
        # E[Y(0)] = E[Y * I(T=0) / P(T=0|X)]   (control)
        # With fixed propensities, this simplifies to weighted averages
        ipw_ate = 0.0
        
        # For treatment: weight = 1/P(T=arm) for treated
        # For control:   weight = 1/P(T=NONE) for controls
        treat_propensity = float(propensities[t_mask][0])  # all same for fixed design
        control_propensity = float(propensities[c_mask][0])
        
        # Horvitz-Thompson estimator
        n = len(logs)
        ht_treatment = (y[t_mask] / treat_propensity).sum() / n
        ht_control = (y[c_mask] / control_propensity).sum() / n
        ipw_ate = ht_treatment - ht_control
        
        # Welch's t-test for significance
        _, pval = stats.ttest_ind(y[t_mask], y[c_mask], equal_var=False)
        
        uplift_abs = treat_conv - base_conv
        uplift_rel = uplift_abs / max(base_conv, 0.0001)
        
        results.append({
            'intervention': arm,
            'sample_size': int(t_mask.sum() + c_mask.sum()),
            'base_conversion': round(float(base_conv), 6),
            'treatment_conv': round(float(treat_conv), 6),
            'absolute_uplift': round(float(uplift_abs), 6),
            'relative_lift': round(float(uplift_rel), 6),
            'p_value': round(float(pval), 8),
            'is_significant': pval < 0.05,
            'ipw_ate': round(float(ipw_ate), 6),
            'notes': (
                f"Fixed-propensity IPW ATE for {arm} vs NONE control. "
                f"Treatment: {int(t_mask.sum())} sessions (p={treat_propensity}). "
                f"Control: {int(c_mask.sum())} sessions (p={control_propensity}). "
                f"Raw lift: {uplift_rel*100:+.1f}%. p={pval:.4f}."
            ),
            'run_id': None
        })

    log.info(f"Evaluated Causal Uplift for {len(results)} intervention arms.")
    return results


# ── Write results to DB ───────────────────────────────────────────────────

def write_results(conn, results: List[Dict], coefficients: List[Dict],
                  feature_importances: List[Dict], effects: List[Dict],
                  uplift: List[Dict]):
    run_id = None
    with conn.cursor() as cur:
        # Deactivate old results
        cur.execute("UPDATE model_evaluation_results SET is_latest = FALSE")
        cur.execute("UPDATE causal_uplift_results SET is_latest = FALSE")

        # Write model evaluation results
        for res in results:
            cur.execute("""
                INSERT INTO model_evaluation_results
                    (model_name, n_train, n_test, n_total, auc_roc, avg_precision,
                     accuracy, cv_auc_mean, cv_auc_std, positive_rate,
                     feature_set, notes)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING run_id
            """, (
                res['model_name'], res['n_train'], res['n_test'], res['n_total'],
                res['auc_roc'], res['avg_precision'], res['accuracy'],
                res['cv_auc_mean'], res['cv_auc_std'], res['positive_rate'],
                res['feature_set'], res['notes'],
            ))
            if run_id is None:
                run_id = cur.fetchone()['run_id']

        # Write coefficients
        if coefficients and run_id:
            cur.execute("DELETE FROM model_coefficients WHERE run_id = %s", (run_id,))
            for coef in coefficients:
                cur.execute("""
                    INSERT INTO model_coefficients
                        (run_id, feature_name, coefficient, std_error, z_score,
                         p_value, odds_ratio, ci_lower, ci_upper,
                         is_significant, interpretation)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (
                    run_id, coef['feature_name'], coef['coefficient'],
                    coef['std_error'], coef['z_score'], coef['p_value'],
                    coef['odds_ratio'], coef['ci_lower'], coef['ci_upper'],
                    coef['is_significant'], coef['interpretation'],
                ))

        # Write feature importances
        if feature_importances and run_id:
            cur.execute("DELETE FROM feature_importance WHERE run_id = %s", (run_id,))
            for fi in feature_importances:
                cur.execute("""
                    INSERT INTO feature_importance
                        (run_id, feature_name, importance, std_dev, rank)
                    VALUES (%s,%s,%s,%s,%s)
                """, (run_id, fi['feature_name'], fi['importance'], fi['std_dev'], fi['rank']))

        # Write behavioral effects
        cur.execute("DELETE FROM behavioral_effects")
        for eff in effects:
            cur.execute("""
                INSERT INTO behavioral_effects
                    (effect_name, effect_type, description, coefficient,
                     p_value, effect_size, sample_n, is_significant,
                     direction, interpretation)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                eff['effect_name'], eff['effect_type'], eff['description'],
                eff['coefficient'], eff['p_value'], eff['effect_size'],
                eff['sample_n'], eff['is_significant'],
                eff['direction'], eff['interpretation'],
            ))

        # Write causal uplift results
        for u in uplift:
            cur.execute("""
                INSERT INTO causal_uplift_results
                    (run_id, intervention, sample_size, base_conversion,
                     treatment_conv, absolute_uplift, relative_lift,
                     p_value, is_significant, ipw_ate, notes)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                run_id, u['intervention'], u['sample_size'], u['base_conversion'],
                u['treatment_conv'], u['absolute_uplift'], u['relative_lift'],
                u['p_value'], u['is_significant'], u['ipw_ate'], u['notes']
            ))

    conn.commit()
    log.info(f"Results written to database (run_id={run_id}).")
    return run_id


# ── Print summary to console ──────────────────────────────────────────────

def print_summary(results: List[Dict], effects: List[Dict], uplift: List[Dict]):
    print("\n" + "="*70)
    print("MODEL EVALUATION SUMMARY")
    print("="*70)

    for r in results:
        print(f"\n{r['model_name']}")
        print(f"  Features:      {r['feature_set']}")
        print(f"  Sample:        {r['n_train']} train / {r['n_test']} test")
        print(f"  AUC-ROC:       {r['auc_roc']:.4f}")
        print(f"  Avg Precision: {r['avg_precision']:.4f}")
        print(f"  CV AUC:        {r['cv_auc_mean']:.4f} ± {r['cv_auc_std']:.4f}")

    print("\n" + "-"*70)
    print("BEHAVIORAL EFFECTS")
    print("-"*70)
    for eff in effects:
        sig = "✓ SIGNIFICANT" if eff['is_significant'] else "✗ not significant"
        print(f"\n{eff['effect_name']} [{sig}]")
        print(f"  r={eff['coefficient']:.3f}, p={eff['p_value']:.4f}, n={eff['sample_n']}")
        print(f"  {eff['interpretation'][:120]}...")

    print("\n" + "-"*70)
    print("CAUSAL INTERVENTION UPLIFT")
    print("-"*70)
    if not uplift:
        print("  No intervention data available yet.")
    for u in uplift:
        sig = "✓ SIGNIFICANT" if u['is_significant'] else "✗ not significant"
        print(f"\nArm: {u['intervention']} [{sig}]")
        print(f"  Sample:      {u['sample_size']}")
        print(f"  Base Conv:   {u['base_conversion']:.1%}")
        print(f"  Arm Conv:    {u['treatment_conv']:.1%}")
        print(f"  Uplift:      {u['absolute_uplift']*100:+.1f}pp ({u['relative_lift']*100:+.1f}%)")
        print(f"  IPW ATE:     {u['ipw_ate']:+.4f}  | p={u['p_value']:.4f}")

    # Honest caveat
    min_n = min(r['n_total'] for r in results) if results else 0
    if min_n < 200:
        print(f"\n⚠  SAMPLE SIZE WARNING: {min_n} observations.")
        print("   Results should be treated as preliminary/indicative.")
        print("   Aim for 500+ observations for reliable conclusions.")
    print("="*70 + "\n")


# ── Main entry point ──────────────────────────────────────────────────────

def run_evaluation_pipeline(conn):
    """Full evaluation pipeline."""
    setup_tables(conn)

    try:
        X_ctx, X_cnt, ctx_names, cnt_names, y = load_features(conn)
    except ValueError as e:
        log.error(str(e))
        return

    all_results = []

    # Model A: count-only baseline
    res_a, model_a, scaler_a, X_test_a, y_test_a, y_prob_a = \
        train_count_baseline(X_cnt, y, cnt_names, conn)
    all_results.append(res_a)

    # Model B: context-aware
    res_lr, res_rf, coefficients, feature_importances, model_lr, model_rf, scaler_b, X_test_b, y_test_b = \
        train_context_model(X_ctx, y, ctx_names, conn)
    all_results.extend([res_lr, res_rf])

    # Behavioral effects
    effects = analyze_behavioral_effects(conn, X_ctx, y, ctx_names)

    # Causal Uplift
    uplift = evaluate_causal_uplift(conn)

    # Write to DB
    write_results(conn, all_results, coefficients, feature_importances, effects, uplift)

    # Save models
    joblib.dump(model_lr, os.path.join(MODEL_DIR, 'lr_context.pkl'))
    joblib.dump(model_rf, os.path.join(MODEL_DIR, 'rf_context.pkl'))
    joblib.dump(scaler_b, os.path.join(MODEL_DIR, 'scaler_context.pkl'))
    joblib.dump(ctx_names, os.path.join(MODEL_DIR, 'feature_names.pkl'))

    print_summary(all_results, effects, uplift)

    return {
        'results': all_results,
        'effects': effects,
        'coefficients': coefficients,
        'feature_importances': feature_importances,
        'uplift': uplift
    }



if __name__ == "__main__":
    conn = get_conn()
    try:
        run_evaluation_pipeline(conn)
    finally:
        conn.close()


# ── Agent wrapper for the Orchestrator ──────────────────────────────────────

try:
    from agent_base import BaseAgent, InsufficientDataError

    class EvaluationAgent(BaseAgent):
        """
        Wraps run_evaluation_pipeline() as an autonomous agent.
        Only runs in --mode=full when ≥30 decision context rows exist.
        """
        name = "EvaluationAgent"
        description = (
            "Logistic Regression + Random Forest evaluation of behavioral context features. "
            "Tests price anchoring and comparison fatigue hypotheses with proper p-values. "
            "Computes IPW causal uplift estimates for A/B intervention arms."
        )
        version = "2.0"
        dependencies = ["ContextAnalysisAgent"]

        def run(self, conn):
            try:
                result = run_evaluation_pipeline(conn)
                n = len(result.get('results', []))
                return n, {
                    "models_evaluated": n,
                    "behavioral_effects": len(result.get('effects', [])),
                    "uplift_arms": len(result.get('uplift', [])),
                }
            except ValueError as e:
                raise InsufficientDataError(str(e))

        def check_health(self, conn):
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS n FROM model_evaluation_results WHERE is_latest = TRUE")
                n = cur.fetchone()["n"]
            return {"latest_models": n}

except ImportError:
    pass  # agent_base not available (standalone usage)
