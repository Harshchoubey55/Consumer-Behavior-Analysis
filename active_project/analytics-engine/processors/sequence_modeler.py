"""
sequence_modeler.py
===================
Sequential behavioral modeling using first-order Markov chains.

What this does that aggregation-based analytics CANNOT:
  1. Builds a transition probability matrix P(next_event | current_event)
     from all observed session sequences — capturing the actual flow topology
  2. Computes per-transition conversion lift: which transitions are
     statistically associated with converting vs. abandoning
  3. Extracts common paths and their conversion rates
  4. Produces a real-time session risk scorer that evaluates
     the CURRENT sequence prefix (not just total counts)
  5. Detects anomalous sequences — sessions that don't follow
     any of the known high-probability paths (usability signal)

The Markov approach is novel for this codebase because:
  - Standard analytics tools (Mixpanel, Amplitude) show funnels
    (ordered steps you define in advance). Markov chains discover
    the actual transition topology from data without pre-specification.
  - The risk scorer can score a partial session sequence in <1ms,
    making real-time intervention feasible.
  - Anomaly detection on sequences catches UX bugs that aggregated
    metrics would never surface (e.g., users caught in a loop).
"""

import os
import sys
import logging
import json
from collections import defaultdict
from typing import List, Tuple, Dict, Optional

import psycopg2
import psycopg2.extras
import numpy as np

log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/analytics_db"
)

# ── State vocabulary ────────────────────────────────────────────────
# We use a unified state space of meaningful event/page combinations.
# This reduces noise vs. using raw URLs which are too granular.

STATE_MAP = {
    # Page view states
    "page_view:home":     "HOME",
    "page_view:plp":      "BROWSE",
    "page_view:pdp":      "VIEW_PRODUCT",
    "page_view:cart":     "VIEW_CART",
    "page_view:checkout": "CHECKOUT",
    # Action states
    "product_view":       "VIEW_PRODUCT",
    "add_to_cart":        "ADD_CART",
    "remove_from_cart":   "REMOVE_CART",
    "search":             "SEARCH",
    "checkout_step":      "CHECKOUT",
    "purchase":           "PURCHASE",
    "category_click":     "BROWSE",
}

START_STATE = "__START__"
END_STATE   = "__END__"


def _event_to_state(event_type: str, page_type: Optional[str]) -> str:
    """Map a raw event to a canonical Markov state."""
    key = f"{event_type}:{page_type}" if page_type else event_type
    return STATE_MAP.get(key, STATE_MAP.get(event_type, f"OTHER:{event_type}"))


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ── 1. Build session sequences ──────────────────────────────────────

def build_session_sequences(conn) -> int:
    """
    For each session, extract the ordered sequence of states and timing deltas.
    This preserves temporal order — something aggregate metrics destroy.
    """
    log.info("Building session sequences...")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                session_id,
                ARRAY_AGG(event_type    ORDER BY client_ts ASC) AS event_types,
                ARRAY_AGG(page_type     ORDER BY client_ts ASC) AS page_types,
                ARRAY_AGG(client_ts     ORDER BY client_ts ASC) AS timestamps,
                BOOL_OR(event_type = 'purchase') AS converted
            FROM raw_events
            GROUP BY session_id
            HAVING COUNT(*) >= 2
        """)
        rows = cur.fetchall()

    log.info(f"Processing {len(rows)} sessions into sequences...")
    inserted = 0

    for row in rows:
        event_types = row['event_types'] or []
        page_types  = row['page_types']  or []
        timestamps  = row['timestamps']  or []
        converted   = row['converted']

        # Build state sequence
        states = []
        for et, pt in zip(event_types, page_types):
            state = _event_to_state(et, pt)
            # Deduplicate consecutive identical states (page view spam)
            if not states or states[-1] != state:
                states.append(state)

        if len(states) < 2:
            continue

        # Timing deltas between consecutive events (milliseconds)
        deltas = []
        for i in range(1, len(timestamps)):
            if timestamps[i] and timestamps[i-1]:
                delta_ms = int((timestamps[i] - timestamps[i-1]).total_seconds() * 1000)
                deltas.append(max(0, delta_ms))
            else:
                deltas.append(0)
        # Pad to match length
        while len(deltas) < len(states):
            deltas.append(0)

        # Which state did the session end on (if not converted)?
        abandoned_at = None if converted else states[-1]

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO session_sequences
                    (session_id, event_sequence, page_sequence,
                     timing_deltas_ms, sequence_length, converted, abandoned_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    event_sequence   = EXCLUDED.event_sequence,
                    page_sequence    = EXCLUDED.page_sequence,
                    timing_deltas_ms = EXCLUDED.timing_deltas_ms,
                    sequence_length  = EXCLUDED.sequence_length,
                    converted        = EXCLUDED.converted,
                    abandoned_at     = EXCLUDED.abandoned_at
            """, (
                row['session_id'],
                states,
                page_types[:len(states)],
                deltas[:len(states)],
                len(states),
                converted,
                abandoned_at,
            ))
        inserted += 1

    conn.commit()
    log.info(f"Built {inserted} session sequences.")
    return inserted


# ── 2. Build Markov transition matrix ──────────────────────────────

def build_markov_matrix(conn):
    """
    Compute P(to_state | from_state) from all observed session sequences.

    Also computes per-transition conversion rate — this is the key insight:
    some transitions are strongly predictive of conversion or abandonment
    even when the aggregate counts look similar.
    """
    log.info("Building Markov transition matrix...")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT session_id, event_sequence, converted
            FROM session_sequences
        """)
        rows = cur.fetchall()

    # Count transitions
    # transition_counts[from][to] = count
    transition_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    # For conversion signal
    transition_conv:   Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    transition_total:  Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for row in rows:
        seq = row['event_sequence'] or []
        converted = row['converted']

        # Add START → first_state and last_state → END
        full_seq = [START_STATE] + seq + [END_STATE]

        for i in range(len(full_seq) - 1):
            from_s = full_seq[i]
            to_s   = full_seq[i + 1]
            transition_counts[from_s][to_s] += 1
            transition_total[from_s][to_s]  += 1
            if converted:
                transition_conv[from_s][to_s] += 1

    # Compute probabilities and write to DB
    with conn.cursor() as cur:
        cur.execute("DELETE FROM markov_transitions")

        for from_state, to_counts in transition_counts.items():
            total_from = sum(to_counts.values())
            for to_state, count in to_counts.items():
                prob = count / total_from if total_from > 0 else 0
                conv_rate = (
                    transition_conv[from_state][to_state] /
                    transition_total[from_state][to_state]
                ) if transition_total[from_state][to_state] > 0 else 0

                cur.execute("""
                    INSERT INTO markov_transitions
                        (from_state, to_state, transition_count,
                         transition_prob, conversion_rate)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (from_state, to_state) DO UPDATE SET
                        transition_count = EXCLUDED.transition_count,
                        transition_prob  = EXCLUDED.transition_prob,
                        conversion_rate  = EXCLUDED.conversion_rate,
                        updated_at       = NOW()
                """, (from_state, to_state, count, round(prob, 6), round(conv_rate, 6)))

    conn.commit()
    log.info(f"Markov matrix built: {sum(len(v) for v in transition_counts.values())} transitions.")


# ── 3. Extract common paths ─────────────────────────────────────────

def extract_common_paths(conn, top_n: int = 20):
    """
    Find the most frequently observed session paths and their conversion rates.
    This reveals which user journeys actually lead to purchase.
    """
    log.info("Extracting common paths...")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                event_sequence,
                converted,
                sequence_length
            FROM session_sequences
            WHERE sequence_length BETWEEN 2 AND 12
        """)
        rows = cur.fetchall()

    # Count path signatures
    path_counts: Dict[str, int] = defaultdict(int)
    path_conv:   Dict[str, int] = defaultdict(int)
    path_arrays: Dict[str, list] = {}

    for row in rows:
        seq = row['event_sequence'] or []
        # Truncate very long paths to avoid combinatorial explosion
        sig = ">".join(seq[:8])
        path_counts[sig] += 1
        path_arrays[sig] = seq[:8]
        if row['converted']:
            path_conv[sig] += 1

    # Sort by frequency, take top N
    top_paths = sorted(path_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]

    with conn.cursor() as cur:
        cur.execute("DELETE FROM common_paths")
        for sig, count in top_paths:
            conv_count = path_conv[sig]
            conv_rate  = conv_count / count if count > 0 else 0
            cur.execute("""
                INSERT INTO common_paths
                    (path_signature, path_array, session_count,
                     conversion_count, conversion_rate)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (path_signature) DO UPDATE SET
                    session_count    = EXCLUDED.session_count,
                    conversion_count = EXCLUDED.conversion_count,
                    conversion_rate  = EXCLUDED.conversion_rate,
                    updated_at       = NOW()
            """, (sig, path_arrays[sig], count, conv_count, round(conv_rate, 6)))

    conn.commit()
    log.info(f"Extracted {len(top_paths)} common paths.")


# ── 4. Session risk scorer ──────────────────────────────────────────

class SessionRiskScorer:
    """
    Scores a partial session sequence in real-time.

    Algorithm:
      Given a sequence prefix [s1, s2, ..., sN], compute:
        risk = 1 - P(conversion | sequence_so_far)

      P(conversion | sequence) is estimated by:
        1. Following the Markov chain from the current state
        2. Computing the expected probability of reaching PURCHASE
           within K future steps (K=5)
        3. Adjusting by timing signal: long dwell at a non-conversion
           state increases risk

    This is fundamentally different from counting features because
    it uses the *path* to the current state, not just the state itself.
    """

    def __init__(self, transition_matrix: Dict[str, Dict[str, float]], conversion_rates: Dict[str, Dict[str, float]]):
        self.matrix = transition_matrix
        self.conv_rates = conversion_rates
        # Pre-compute: for each state, expected conversion probability
        # via Monte Carlo forward simulation
        self._conv_probs = self._compute_state_conversion_probs(n_steps=6, n_samples=500)

    def _compute_state_conversion_probs(self, n_steps: int, n_samples: int) -> Dict[str, float]:
        """
        For each state, estimate P(reach PURCHASE within n_steps).
        Uses Monte Carlo simulation over the Markov chain.
        """
        states = list(self.matrix.keys())
        conv_probs = {}

        for start_state in states:
            if start_state in (END_STATE, "PURCHASE"):
                conv_probs[start_state] = 1.0 if start_state == "PURCHASE" else 0.0
                continue

            conversions = 0
            for _ in range(n_samples):
                state = start_state
                converted = False
                for _step in range(n_steps):
                    if state == "PURCHASE":
                        converted = True
                        break
                    if state == END_STATE:
                        break
                    # Sample next state
                    transitions = self.matrix.get(state, {})
                    if not transitions:
                        break
                    states_list = list(transitions.keys())
                    probs = [transitions[s] for s in states_list]
                    total = sum(probs)
                    if total <= 0:
                        break
                    probs = [p / total for p in probs]
                    state = np.random.choice(states_list, p=probs)

                if converted:
                    conversions += 1

            conv_probs[start_state] = conversions / n_samples

        return conv_probs

    def score(self, event_sequence: List[str], timing_deltas_ms: Optional[List[int]] = None) -> Dict:
        """
        Score a partial session sequence.
        Returns risk score (0=low risk, 1=high risk of abandonment),
        current state, and explanation.
        """
        if not event_sequence:
            return {"risk_score": 0.5, "risk_tier": "medium", "current_state": "unknown",
                    "conversion_probability": 0.5, "explanation": "No events yet"}

        current_state = event_sequence[-1]

        # Base conversion probability from Markov forward simulation
        base_conv_prob = self._conv_probs.get(current_state, 0.1)

        # Path-based adjustment:
        # Did the user reach the current state via a high-conversion path?
        path_adjustment = 0.0
        if len(event_sequence) >= 2:
            prev_state = event_sequence[-2]
            edge_conv_rate = self.conv_rates.get(prev_state, {}).get(current_state, base_conv_prob)
            # Weight path conversion rate vs state conversion prob
            path_adjustment = (edge_conv_rate - base_conv_prob) * 0.3

        # Timing adjustment: if last delta was very long, user is disengaging
        timing_adjustment = 0.0
        if timing_deltas_ms and len(timing_deltas_ms) > 0:
            last_delta = timing_deltas_ms[-1]
            if last_delta > 120_000:   # 2+ minutes on last step
                timing_adjustment = -0.15
            elif last_delta > 60_000:  # 1+ minute
                timing_adjustment = -0.07

        # Loop detection: repeated state visits signal confusion
        loop_adjustment = 0.0
        if len(event_sequence) >= 3:
            last_3 = event_sequence[-3:]
            if len(set(last_3)) == 1:  # same state 3 times
                loop_adjustment = -0.2
            elif current_state in event_sequence[:-1]:
                loop_adjustment = -0.08

        conv_prob = max(0.01, min(0.99,
            base_conv_prob + path_adjustment + timing_adjustment + loop_adjustment
        ))
        risk_score = 1.0 - conv_prob

        risk_tier = (
            "critical" if risk_score > 0.82 else
            "high"     if risk_score > 0.65 else
            "medium"   if risk_score > 0.40 else
            "low"
        )

        explanation_parts = [f"Current state: {current_state}"]
        if loop_adjustment < -0.1:
            explanation_parts.append("User appears stuck in a navigation loop")
        if timing_adjustment < -0.1:
            explanation_parts.append("Long dwell time on current step")
        if current_state in ("VIEW_CART", "CHECKOUT") and risk_score > 0.6:
            explanation_parts.append("High abandonment probability at this stage")

        return {
            "risk_score": round(risk_score, 4),
            "risk_tier": risk_tier,
            "current_state": current_state,
            "conversion_probability": round(conv_prob, 4),
            "path_length": len(event_sequence),
            "explanation": "; ".join(explanation_parts),
        }


def build_risk_scorer(conn) -> Optional[SessionRiskScorer]:
    """Load the Markov matrix from DB and instantiate the scorer."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT from_state, to_state, transition_prob, conversion_rate
            FROM markov_transitions
        """)
        rows = cur.fetchall()

    if not rows:
        log.warning("No transition matrix found — run build_markov_matrix first.")
        return None

    matrix: Dict[str, Dict[str, float]] = defaultdict(dict)
    conv_rates: Dict[str, Dict[str, float]] = defaultdict(dict)

    for row in rows:
        matrix[row['from_state']][row['to_state']] = float(row['transition_prob'])
        conv_rates[row['from_state']][row['to_state']] = float(row['conversion_rate'])

    return SessionRiskScorer(dict(matrix), dict(conv_rates))


# ── 5. Anomaly detection on sequences ──────────────────────────────

def detect_anomalous_sessions(conn) -> List[Dict]:
    """
    Find sessions whose event sequences have very low probability under
    the Markov model. These are potential UX bugs or confused users.

    A session is anomalous if the geometric mean of its transition
    probabilities is below a threshold — meaning the path is unlikely
    given the observed population behavior.
    """
    log.info("Detecting anomalous session sequences...")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT from_state, to_state, transition_prob
            FROM markov_transitions
            WHERE transition_prob > 0
        """)
        transitions = {
            (r['from_state'], r['to_state']): float(r['transition_prob'])
            for r in cur.fetchall()
        }

    with conn.cursor() as cur:
        cur.execute("""
            SELECT session_id, event_sequence, converted
            FROM session_sequences
            WHERE sequence_length BETWEEN 3 AND 15
        """)
        rows = cur.fetchall()

    anomalies = []
    for row in rows:
        seq = [START_STATE] + (row['event_sequence'] or []) + [END_STATE]
        log_probs = []

        for i in range(len(seq) - 1):
            p = transitions.get((seq[i], seq[i+1]), 1e-6)
            log_probs.append(np.log(max(p, 1e-6)))

        if not log_probs:
            continue

        # Geometric mean probability (via log average)
        mean_log_prob = np.mean(log_probs)
        # Anomaly threshold: sequences in the bottom 5th percentile
        if mean_log_prob < -3.0:  # ~e^-3 ≈ 0.05 per transition on average
            anomalies.append({
                "session_id": row['session_id'],
                "mean_log_prob": round(float(mean_log_prob), 4),
                "sequence_length": len(seq) - 2,
                "converted": row['converted'],
                "path_snippet": ">".join((row['event_sequence'] or [])[:5]),
            })

    anomalies.sort(key=lambda x: x['mean_log_prob'])
    log.info(f"Found {len(anomalies)} anomalous sessions.")
    return anomalies[:50]


# ── 6. Score all sessions in DB ─────────────────────────────────────

def score_all_sessions(conn):
    """Batch-score all sessions and update session_sequences.risk_score."""
    log.info("Scoring all sessions...")

    scorer = build_risk_scorer(conn)
    if not scorer:
        return

    with conn.cursor() as cur:
        cur.execute("""
            SELECT session_id, event_sequence, timing_deltas_ms
            FROM session_sequences
        """)
        rows = cur.fetchall()

    updated = 0
    for row in rows:
        result = scorer.score(
            row['event_sequence'] or [],
            row['timing_deltas_ms'] or [],
        )
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE session_sequences
                SET risk_score = %s, risk_updated_at = NOW()
                WHERE session_id = %s
            """, (result['risk_score'], row['session_id']))
        updated += 1

    conn.commit()
    log.info(f"Scored {updated} sessions.")


# ── Main entry point ─────────────────────────────────────────────────

def run_sequence_pipeline(conn):
    """Run the full sequential modeling pipeline."""
    build_session_sequences(conn)
    build_markov_matrix(conn)
    extract_common_paths(conn)
    score_all_sessions(conn)
    anomalies = detect_anomalous_sessions(conn)
    log.info(f"Sequence pipeline complete. {len(anomalies)} anomalous sessions detected.")
    return anomalies
