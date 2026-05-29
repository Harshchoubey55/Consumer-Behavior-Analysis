"""
pipeline_agents.py
==================
Concrete agent implementations wrapping all existing pipeline stages.

Each class is a thin wrapper around the logic that already exists in
pipeline.py — no logic was rewritten, just encapsulated into agents.

New agents added here:
  - AnomalyDetectionAgent: surfaces Markov path anomalies to the DB
"""

import logging
import math
from collections import defaultdict
from typing import Any, Dict, List, Tuple
import numpy as np

from agent_base import BaseAgent, InsufficientDataError

log = logging.getLogger(__name__)


# ── Helper: re-use all pipeline logic from pipeline.py ─────────────────────
# We import the functions directly from pipeline.py to avoid duplication.

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import pipeline as _pl  # all the existing stage functions


# ────────────────────────────────────────────────────────────────────────────
# STAGE 1 — Sessionization
# ────────────────────────────────────────────────────────────────────────────

class SessionizationAgent(BaseAgent):
    name = "SessionizationAgent"
    description = "Aggregates raw_events into session-level records. Foundation for all downstream agents."
    version = "1.0"
    dependencies = []  # first in the chain — no dependencies

    def run(self, conn) -> Tuple[int, Dict]:
        _pl.refresh_sessions(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM sessions")
            n = cur.fetchone()["n"]
        return n, {"session_count": n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) AS n,
                       MAX(updated_at) AS latest
                FROM sessions
            """)
            row = cur.fetchone()
        return {"session_count": row["n"], "latest_update": str(row["latest"])}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 2 — Product Analytics
# ────────────────────────────────────────────────────────────────────────────

class ProductAnalyticsAgent(BaseAgent):
    name = "ProductAnalyticsAgent"
    description = "Computes per-product engagement metrics: view counts, cart rates, purchase rates."
    version = "1.0"
    dependencies = ["SessionizationAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        _pl.refresh_product_analytics(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM product_analytics")
            n = cur.fetchone()["n"]
        return n, {"product_count": n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n, AVG(view_to_cart_rate) AS avg_vtc FROM product_analytics")
            row = cur.fetchone()
        return {"product_count": row["n"], "avg_view_to_cart": float(row["avg_vtc"] or 0)}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 3 — User Feature Engineering
# ────────────────────────────────────────────────────────────────────────────

class UserFeatureAgent(BaseAgent):
    name = "UserFeatureAgent"
    description = "Builds ML-ready behavioral feature vectors per user (RFM, engagement tier, churn risk)."
    version = "1.0"
    dependencies = ["SessionizationAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        _pl.compute_user_features(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM user_features")
            n = cur.fetchone()["n"]
        return n, {"user_count": n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) AS n,
                       AVG(engagement_score) AS avg_eng
                FROM user_features
            """)
            row = cur.fetchone()
        return {"user_count": row["n"], "avg_engagement": float(row["avg_eng"] or 0)}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 4 — Daily KPIs
# ────────────────────────────────────────────────────────────────────────────

class KPIAgent(BaseAgent):
    name = "KPIAgent"
    description = "Computes daily KPI snapshots: sessions, users, bounce rate, conversion rate."
    version = "1.0"
    dependencies = ["SessionizationAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        _pl.refresh_daily_kpis(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM daily_kpis")
            n = cur.fetchone()["n"]
        return n, {"kpi_days": n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT kpi_date, conversion_rate
                FROM daily_kpis
                ORDER BY kpi_date DESC LIMIT 1
            """)
            row = cur.fetchone()
        return {"latest_date": str(row["kpi_date"]) if row else None,
                "latest_conv_rate": float(row["conversion_rate"] or 0) if row else 0}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 5 — Funnel Snapshots
# ────────────────────────────────────────────────────────────────────────────

class FunnelAgent(BaseAgent):
    name = "FunnelAgent"
    description = "Builds funnel snapshot: home→PLP→PDP→cart→checkout→purchase drop-off rates."
    version = "1.0"
    dependencies = ["SessionizationAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        _pl.refresh_funnel(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM funnel_snapshots")
            n = cur.fetchone()["n"]
        return n, {"funnel_steps": n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM funnel_snapshots WHERE snapshot_date = CURRENT_DATE")
            n = cur.fetchone()["n"]
        return {"today_steps": n}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 6 — Recommendations
# ────────────────────────────────────────────────────────────────────────────

class RecommendationAgent(BaseAgent):
    name = "RecommendationAgent"
    description = "Generates prescriptive recommendations for low-converting products and high-churn users."
    version = "1.0"
    dependencies = ["ProductAnalyticsAgent", "UserFeatureAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        _pl.generate_recommendations(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM recommendations WHERE is_active = TRUE")
            n = cur.fetchone()["n"]
        return n, {"active_recommendations": n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT severity, COUNT(*) AS n FROM recommendations WHERE is_active=TRUE GROUP BY severity")
            rows = cur.fetchall()
        return {r["severity"]: r["n"] for r in rows}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 7-9 — Sequence Modeling (Markov + Paths)
# ────────────────────────────────────────────────────────────────────────────

class SequenceModelAgent(BaseAgent):
    name = "SequenceModelAgent"
    description = "Builds Markov transition matrix over behavioral states. Descriptive only — feeds AnomalyDetection and real-time scoring."
    version = "1.0"
    dependencies = ["SessionizationAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        _pl.build_session_sequences(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM session_sequences")
            seq_n = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM markov_transitions")
            mat_n = cur.fetchone()["n"]
        return seq_n, {"session_sequences": seq_n, "markov_edges": mat_n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM markov_transitions")
            n = cur.fetchone()["n"]
        return {"markov_edges": n}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 10 — Context Analysis
# ────────────────────────────────────────────────────────────────────────────

class ContextAnalysisAgent(BaseAgent):
    name = "ContextAnalysisAgent"
    description = "Reconstructs the decision environment at each product view. The core novel contribution."
    version = "1.0"
    dependencies = ["SessionizationAgent", "ProductAnalyticsAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        from context_analyzer import run_context_pipeline
        run_context_pipeline(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM decision_contexts")
            ctx_n = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM context_insights WHERE is_active=TRUE")
            ins_n = cur.fetchone()["n"]
        return ctx_n, {"decision_contexts": ctx_n, "active_insights": ins_n}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM context_insights WHERE is_active=TRUE")
            n = cur.fetchone()["n"]
        return {"active_insights": n}


# ────────────────────────────────────────────────────────────────────────────
# STAGE 11 — Intervention Experiment (Reward Backfill)
# ────────────────────────────────────────────────────────────────────────────

class InterventionAgent(BaseAgent):
    name = "InterventionAgent"
    description = "Backfills intervention outcomes. Links assigned A/B arms to session conversion results."
    version = "1.0"
    dependencies = ["SessionizationAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        from causal_bandit import backfill_rewards, get_arm_summary
        updated = backfill_rewards(conn)
        summary = get_arm_summary(conn)
        return updated, {"updated_logs": updated, "arm_summary": summary}

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT assigned_arm,
                       COUNT(*) AS pulls,
                       ROUND(AVG(outcome::numeric)*100, 2) AS conv_rate
                FROM intervention_logs
                WHERE outcome_updated = TRUE
                GROUP BY assigned_arm
            """)
            rows = cur.fetchall()
        return {r["assigned_arm"]: {"pulls": r["pulls"], "conv_rate": float(r["conv_rate"] or 0)} for r in rows}


# ────────────────────────────────────────────────────────────────────────────
# STAGE (NEW) — Anomaly Detection
# ────────────────────────────────────────────────────────────────────────────

class AnomalyDetectionAgent(BaseAgent):
    """
    Surfaces sessions whose behavioral path is statistically improbable
    given the Markov transition matrix.

    Algorithm:
      1. For each session sequence, compute cumulative log-probability
         by multiplying transition probs along the path.
      2. Compute z-score over all sessions' log-probabilities.
      3. Sessions with z < -2 are flagged as anomalous.
      4. Write to session_anomalies table.
    """
    name = "AnomalyDetectionAgent"
    description = "Detects sessions with improbable behavioral paths using Markov log-probability scoring."
    version = "1.0"
    dependencies = ["SequenceModelAgent"]

    def run(self, conn) -> Tuple[int, Dict]:
        # Load Markov matrix
        with conn.cursor() as cur:
            cur.execute("""
                SELECT from_state, to_state, transition_prob
                FROM markov_transitions
                WHERE from_state NOT IN ('__START__', '__END__')
            """)
            transitions = cur.fetchall()

        if not transitions:
            raise InsufficientDataError("No Markov transitions found. Run SequenceModelAgent first.")

        matrix: Dict[str, Dict[str, float]] = defaultdict(dict)
        for row in transitions:
            matrix[row["from_state"]][row["to_state"]] = float(row["transition_prob"])

        # Load all session sequences
        with conn.cursor() as cur:
            cur.execute("""
                SELECT session_id, event_sequence, sequence_length, converted
                FROM session_sequences
                WHERE sequence_length >= 2
            """)
            sessions = cur.fetchall()

        if len(sessions) < 5:
            raise InsufficientDataError(f"Only {len(sessions)} sessions — need ≥5 for anomaly detection.")

        LOG_FLOOR = -20.0  # floor for zero-probability transitions

        def session_log_prob(seq: List[str]) -> float:
            log_p = 0.0
            for i in range(len(seq) - 1):
                p = matrix.get(seq[i], {}).get(seq[i + 1], 0.0)
                log_p += math.log(max(p, 1e-9))
            return log_p

        log_probs = []
        for s in sessions:
            seq = s["event_sequence"] or []
            lp = session_log_prob(seq)
            log_probs.append((s["session_id"], seq, lp, s["sequence_length"], s["converted"]))

        lp_values = np.array([x[2] for x in log_probs])
        mean_lp = float(np.mean(lp_values))
        std_lp  = float(np.std(lp_values)) or 1.0

        anomalies = []
        for sid, seq, lp, seqlen, converted in log_probs:
            z = (lp - mean_lp) / std_lp
            if z < -2.0:
                # Classify anomaly type
                if seqlen <= 2:
                    atype = "ultra_short"
                elif len(seq) != len(set(seq)):
                    repeats = len(seq) - len(set(seq))
                    atype = "loop_heavy" if repeats >= 2 else "improbable_path"
                else:
                    atype = "improbable_path"

                sig = "→".join(seq[:8]) + ("→..." if len(seq) > 8 else "")
                anomalies.append((sid, seqlen, round(lp, 6), round(z, 4), atype, sig, converted))

        if anomalies:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM session_anomalies")
                for sid, seqlen, lp, z, atype, sig, conv in anomalies:
                    cur.execute("""
                        INSERT INTO session_anomalies
                            (session_id, sequence_length, log_probability, z_score,
                             anomaly_type, path_signature, converted)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (session_id) DO UPDATE SET
                            z_score       = EXCLUDED.z_score,
                            anomaly_type  = EXCLUDED.anomaly_type,
                            flagged_at    = NOW()
                    """, (sid, seqlen, lp, z, atype, sig, conv))
            conn.commit()

        log.info(f"[AnomalyDetectionAgent] Flagged {len(anomalies)} anomalous sessions "
                 f"(z < -2) out of {len(sessions)} total.")
        return len(anomalies), {
            "total_sessions": len(sessions),
            "anomalous_sessions": len(anomalies),
            "mean_log_prob": round(mean_lp, 4),
            "std_log_prob": round(std_lp, 4),
        }

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM session_anomalies")
            n = cur.fetchone()["n"]
        return {"flagged_sessions": n}
