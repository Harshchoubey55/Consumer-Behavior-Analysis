"""
causal_bandit.py  →  intervention_experiment.py
================================================
Randomized Controlled Intervention Experiment.

Replaces the adaptive LinUCB bandit with FIXED-PROBABILITY A/B/C randomization.
This design makes IPW/CATE mathematically valid because propensity scores are
known constants, not changing model outputs.

Arms:
  0 = NONE           (control)       — propensity = 0.50
  1 = COMPARE_MATRIX (treatment A)   — propensity = 0.25
  2 = PRICE_REFRAME  (treatment B)   — propensity = 0.25

Pipeline integration:
  - Stage 12 in pipeline.py calls run_intervention_pipeline(conn)
  - This does a REWARD BACKFILL: finds intervention_logs where outcome has not
    been updated, joins with sessions to check if the session converted, and
    writes the reward back.
"""

import os
import json
import random
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Fixed-probability arm configuration ─────────────────────────────
ARMS = {
    'NONE':           {'propensity': 0.50, 'cumulative': 0.50},
    'COMPARE_MATRIX': {'propensity': 0.25, 'cumulative': 0.75},
    'PRICE_REFRAME':  {'propensity': 0.25, 'cumulative': 1.00},
}

ARM_ORDER = ['NONE', 'COMPARE_MATRIX', 'PRICE_REFRAME']
PROPENSITIES = {arm: ARMS[arm]['propensity'] for arm in ARM_ORDER}


def assign_arm():
    """
    Randomly assign an arm with fixed probabilities.
    Returns (arm_name: str, propensity: float).
    """
    r = random.random()
    cumulative = 0.0
    for arm in ARM_ORDER:
        cumulative += ARMS[arm]['propensity']
        if r < cumulative:
            return arm, ARMS[arm]['propensity']
    # Fallback (shouldn't reach here)
    return 'NONE', 0.50


def get_propensity(arm_name: str) -> float:
    """Return the known propensity for an arm."""
    return PROPENSITIES.get(arm_name, 0.50)


# ── Reward Backfill ──────────────────────────────────────────────────

def backfill_rewards(conn):
    """
    Link intervention assignments to session outcomes.
    
    For every intervention_log where outcome_updated = FALSE,
    look up whether that session eventually converted (from sessions table).
    Update the outcome accordingly.
    
    This closes the reward loop that was completely missing before.
    """
    logger.info("Backfilling intervention rewards from session outcomes...")
    
    with conn.cursor() as cur:
        # Find all un-updated intervention logs and join with sessions
        cur.execute("""
            UPDATE intervention_logs il
            SET 
                outcome = CASE WHEN s.converted THEN 1 ELSE 0 END,
                outcome_updated = TRUE
            FROM sessions s
            WHERE il.session_id = s.session_id
              AND il.outcome_updated = FALSE
        """)
        updated = cur.rowcount
    
    conn.commit()
    logger.info(f"Reward backfill complete: {updated} intervention logs updated.")
    return updated


# ── Arm Summary Stats ────────────────────────────────────────────────

def get_arm_summary(conn):
    """
    Compute per-arm statistics for the dashboard.
    Returns list of dicts with: arm_name, pulls, conversions, empirical_rate.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 
                assigned_arm AS arm_name,
                COUNT(*) AS pulls,
                SUM(CASE WHEN outcome = 1 THEN 1 ELSE 0 END) AS conversions,
                ROUND(AVG(outcome::numeric) * 100, 2) AS empirical_conversion_rate
            FROM intervention_logs
            WHERE outcome_updated = TRUE
            GROUP BY assigned_arm
            ORDER BY pulls DESC
        """)
        rows = cur.fetchall()
    
    return [dict(r) for r in rows]


# ── Pipeline Entry Point ─────────────────────────────────────────────

def run_intervention_pipeline(conn):
    """
    Stage 12 of the analytics pipeline.
    
    1. Backfill rewards (link session outcomes to prior interventions)
    2. Log arm summary stats
    """
    logger.info("=" * 50)
    logger.info("Stage 12: Intervention Experiment — Reward Backfill")
    logger.info("=" * 50)
    
    # Step 1: Backfill rewards
    updated = backfill_rewards(conn)
    
    # Step 2: Log summary
    summary = get_arm_summary(conn)
    if summary:
        logger.info("Arm performance summary:")
        for arm in summary:
            logger.info(
                f"  {arm['arm_name']:20s} | "
                f"pulls={arm['pulls']:4d} | "
                f"conversions={arm['conversions']:3d} | "
                f"rate={arm['empirical_conversion_rate']}%"
            )
    else:
        logger.info("No intervention data yet. Awaiting storefront traffic.")
    
    logger.info("Stage 12 complete.")
    return summary
