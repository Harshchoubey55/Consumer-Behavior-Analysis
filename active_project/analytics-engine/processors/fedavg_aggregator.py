"""
fedavg_aggregator.py
====================
FedAvg-Inspired Federated Behavioral Phenotyping.

What this is (honestly framed):
  An architectural adaptation of McMahan et al. (2017)'s FedAvg algorithm
  for a web analytics context. Instead of centralizing every scroll event,
  each user's browser trains a local logistic regression on their own session
  data and sends only a compressed gradient vector (Δw) to the server.
  The server aggregates these via weighted averaging (FedAvg) and clusters
  the per-session Δw vectors to discover behavioral phenotypes — without
  ever seeing the raw interaction data.

What this is NOT:
  Full federated learning with cryptographic privacy guarantees, differential
  privacy, or a distributed fleet of devices. This is an architectural
  adaptation for a single-server web analytics platform. It is framed as
  "FedAvg-inspired" in all documentation.

Novelty claim:
  "Federated Behavioral Phenotyping — inferring consumer decision style
  archetypes from on-device gradient updates without centralizing raw
  interaction data." This does not appear in published literature in this form.

Pipeline:
  Phase 1 (browser)  — tracker.ts collects session events
  Phase 2 (browser)  — local_model.ts runs 3 SGD passes on session data
  Phase 3 (browser)  — computes Δw = w_local - w_global, POSTs sparse delta
  Phase 4 (this file) — FedAvg aggregation of pending deltas
  Phase 5 (this file) — Federated phenotyping: K-Means on Δw vectors
"""

import logging
import uuid
import warnings
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

warnings.filterwarnings("ignore")
log = logging.getLogger(__name__)

try:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import silhouette_score
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

from agent_base import BaseAgent, InsufficientDataError

# ── Feature names (must match local_model.ts FEATURE_NAMES) ─────────────────
FEATURE_NAMES = [
    "prior_product_views",
    "prior_cart_adds",
    "prior_searches",
    "session_duration_s",
    "price_rank_in_session",
    "price_vs_median_pct",
    "is_most_expensive",
    "is_cheapest",
    "scroll_depth_pct",
    "time_on_page_s",
    "is_from_search",
    "is_return_view",
    "same_category_views",
    "hour_of_day",
    "scroll_velocity",
]
N_FEATURES = len(FEATURE_NAMES)


def _reconstruct_delta(indices: List[int], values: List[float]) -> np.ndarray:
    """Convert sparse (indices, values) representation back to dense Δw."""
    delta = np.zeros(N_FEATURES)
    for idx, val in zip(indices, values):
        if 0 <= idx < N_FEATURES:
            delta[idx] = float(val)
    return delta


def _name_federated_cluster(centroid: np.ndarray) -> str:
    """
    Name a federated phenotype cluster based on which gradient dimensions
    have the largest magnitude. The gradient dimension tells us which feature
    the local model was most sensitive to during training.
    """
    dominant_idx = int(np.argmax(np.abs(centroid)))
    dominant_feat = FEATURE_NAMES[dominant_idx] if dominant_idx < N_FEATURES else "unknown"

    name_map = {
        "prior_product_views":  "High-Comparison Gradient",
        "price_vs_median_pct":  "Price-Anchored Gradient",
        "scroll_depth_pct":     "Engagement-Driven Gradient",
        "is_from_search":       "Search-Intent Gradient",
        "is_return_view":       "Return-Visit Gradient",
        "prior_cart_adds":      "Decisive-Buyer Gradient",
        "same_category_views":  "Category-Focus Gradient",
        "session_duration_s":   "Long-Session Gradient",
        "time_on_page_s":       "Deliberate-Dwell Gradient",
    }
    return name_map.get(dominant_feat, f"Gradient-Type-{dominant_idx}")


class FedAvgAgent(BaseAgent):
    """
    Aggregates client gradient deltas from fedavg_updates table using
    the FedAvg weighted averaging formula, then performs federated
    phenotyping by clustering the Δw vectors.
    """
    name = "FedAvgAgent"
    description = (
        "FedAvg-inspired aggregation of on-device gradient updates. "
        "Maintains a global behavioral model without centralizing raw interaction data. "
        "Performs federated phenotyping by clustering gradient vectors."
    )
    version = "1.0"
    dependencies = ["PhenotypeAgent"]  # run after standard phenotypes for comparison

    def run(self, conn) -> Tuple[int, Dict]:
        if not HAS_SKLEARN:
            raise InsufficientDataError("scikit-learn required for FedAvgAgent.")

        # ── Step 1: Load pending gradient deltas ─────────────────────────
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, session_id, n_samples, delta_indices, delta_values
                FROM fedavg_updates
                WHERE applied = FALSE
                ORDER BY client_ts ASC
            """)
            updates = cur.fetchall()

        if not updates:
            raise InsufficientDataError(
                "No pending FedAvg updates found. "
                "Users need ≥3 product views in a session to generate a gradient. "
                "This is expected on first run — the system will accumulate updates as users browse."
            )

        log.info(f"[FedAvgAgent] Processing {len(updates)} pending gradient updates...")

        # ── Step 2: Reconstruct dense Δw vectors ─────────────────────────
        session_ids = []
        deltas = []
        n_samples_list = []

        for row in updates:
            indices = row["delta_indices"] or []
            values  = row["delta_values"]  or []
            delta   = _reconstruct_delta([int(i) for i in indices],
                                         [float(v) for v in values])
            session_ids.append(row["session_id"])
            deltas.append(delta)
            n_samples_list.append(int(row["n_samples"] or 1))

        deltas_array = np.array(deltas)          # shape: (n_updates, 15)
        n_samples_array = np.array(n_samples_list)

        # ── Step 3: FedAvg aggregation ───────────────────────────────────
        # Load current global model
        with conn.cursor() as cur:
            cur.execute("SELECT weights, n_total_samples, n_rounds FROM global_model WHERE id = 1")
            gm = cur.fetchone()

        if gm is None:
            w_global = np.zeros(N_FEATURES)
            n_total_prev = 0
            n_rounds_prev = 0
        else:
            w_global = np.array([float(w) for w in gm["weights"]])
            n_total_prev = int(gm["n_total_samples"] or 0)
            n_rounds_prev = int(gm["n_rounds"] or 0)

        # FedAvg formula:
        # w_new = w_old + Σ(nk * Δwk) / Σ(nk)
        total_n = n_samples_array.sum()
        weighted_delta = np.average(deltas_array, axis=0, weights=n_samples_array)
        w_new = w_global + weighted_delta

        # Clip weights to prevent explosion
        w_new = np.clip(w_new, -5.0, 5.0)

        log.info(f"[FedAvgAgent] FedAvg round {n_rounds_prev + 1}: "
                 f"aggregated {len(updates)} updates, total_n={total_n}")

        # ── Step 4: Write updated global model ───────────────────────────
        with conn.cursor() as cur:
            w_list = [round(float(w), 8) for w in w_new]
            cur.execute("""
                UPDATE global_model SET
                    weights          = %s,
                    n_total_samples  = %s,
                    n_rounds         = %s,
                    last_updated     = NOW()
                WHERE id = 1
            """, (w_list, n_total_prev + total_n, n_rounds_prev + 1))

            # Mark updates as applied
            update_ids = [row["id"] for row in updates]
            cur.execute("""
                UPDATE fedavg_updates SET applied = TRUE, applied_at = NOW()
                WHERE id = ANY(%s)
            """, (update_ids,))
        conn.commit()

        # ── Step 5: Federated Phenotyping — cluster Δw vectors ───────────
        run_id = str(uuid.uuid4())
        fed_phenotype_count = 0

        if len(deltas) >= 6 and HAS_SKLEARN:
            scaler = StandardScaler()
            D_scaled = scaler.fit_transform(deltas_array)

            best_k = 2
            best_score = -1.0
            k_max = min(5, len(deltas) // 3)
            for k in range(2, max(3, k_max + 1)):
                km_try = KMeans(n_clusters=k, random_state=42, n_init=10)
                lab_try = km_try.fit_predict(D_scaled)
                if len(set(lab_try)) < 2:
                    continue
                score = silhouette_score(D_scaled, lab_try)
                if score > best_score:
                    best_score = score
                    best_k = k

            km = KMeans(n_clusters=best_k, random_state=42, n_init=20)
            fed_labels = km.fit_predict(D_scaled)
            centroids = scaler.inverse_transform(km.cluster_centers_)

            with conn.cursor() as cur:
                for i, (sid, lbl) in enumerate(zip(session_ids, fed_labels)):
                    delta_mag = float(np.linalg.norm(deltas[i]))
                    cluster_name = _name_federated_cluster(centroids[lbl])
                    cur.execute("""
                        INSERT INTO federated_phenotypes
                            (run_id, session_id, cluster_index, cluster_name, delta_magnitude)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (run_id, session_id) DO UPDATE SET
                            cluster_index = EXCLUDED.cluster_index,
                            cluster_name  = EXCLUDED.cluster_name,
                            assigned_at   = NOW()
                    """, (run_id, sid, int(lbl), cluster_name, round(delta_mag, 6)))
            conn.commit()
            fed_phenotype_count = len(deltas)

            log.info(f"[FedAvgAgent] Federated phenotyping: K={best_k}, "
                     f"silhouette={best_score:.4f}, sessions={fed_phenotype_count}")
        else:
            log.info(f"[FedAvgAgent] Not enough updates ({len(deltas)}) for federated clustering. "
                     "Will cluster on next run when more data accumulates.")

        return len(updates), {
            "updates_processed": len(updates),
            "total_n_samples": int(total_n),
            "fedavg_rounds": n_rounds_prev + 1,
            "fed_phenotypes_assigned": fed_phenotype_count,
            "global_weights_norm": round(float(np.linalg.norm(w_new)), 4),
        }

    def check_health(self, conn) -> Dict[str, Any]:
        with conn.cursor() as cur:
            cur.execute("SELECT n_rounds, n_total_samples FROM global_model WHERE id = 1")
            row = cur.fetchone()
            cur.execute("SELECT COUNT(*) AS n FROM fedavg_updates WHERE applied = FALSE")
            pending = cur.fetchone()["n"]
        return {
            "fedavg_rounds": row["n_rounds"] if row else 0,
            "total_samples": row["n_total_samples"] if row else 0,
            "pending_updates": pending,
        }
