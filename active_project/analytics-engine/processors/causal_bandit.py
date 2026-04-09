"""
Causal Bandit Intervention Engine
Uses a Contextual Bandit (LinUCB) to determine if a UI intervention 
will yield a causal uplift in conversion.
"""

import os
import json
import numpy as np
import logging

logger = logging.getLogger(__name__)

class CausalBandit:
    def __init__(self, n_features=15, alpha=0.1):
        self.n_features = n_features
        self.alpha = alpha
        
        # A matrix for each arm (0: No Intervention, 1: Compare UI, 2: Reframe Price UI)
        self.n_arms = 3
        self.A = [np.identity(self.n_features) for _ in range(self.n_arms)]
        self.b = [np.zeros((self.n_features, 1)) for _ in range(self.n_arms)]
        
        # Warm start
        self._seed_priors()

    def _seed_priors(self):
        # Priors to avoid initial random chaos
        # Arm 1 (Compare UI) works well for high "prior_product_views"
        self.b[1][0] = 0.5 
        # Arm 2 (Reframe Price UI) works well for high "price_vs_median"
        self.b[2][5] = 0.5

    def get_action(self, context_vector):
        """
        Uses LinUCB to select an arm.
        context_vector: numpy array of shape (n_features, 1)
        """
        if len(context_vector) != self.n_features:
            logger.warning(f"Feature dimension mismatch. Expected {self.n_features}, got {len(context_vector)}")
            # Pad or truncate
            if len(context_vector) < self.n_features:
                context_vector = np.pad(context_vector, (0, self.n_features - len(context_vector)))
            else:
                context_vector = context_vector[:self.n_features]
        
        context_vector = context_vector.reshape(-1, 1)
        p = np.zeros(self.n_arms)
        
        for a in range(self.n_arms):
            A_inv = np.linalg.inv(self.A[a])
            theta_a = A_inv.dot(self.b[a])
            p[a] = theta_a.T.dot(context_vector) + self.alpha * np.sqrt(context_vector.T.dot(A_inv).dot(context_vector))
            
        return int(np.argmax(p))

    def update(self, arm, context_vector, reward):
        """
        Update the model after observing a reward (0 = bounce, 1 = convert).
        """
        if len(context_vector) != self.n_features:
            if len(context_vector) < self.n_features:
                context_vector = np.pad(context_vector, (0, self.n_features - len(context_vector)))
            else:
                context_vector = context_vector[:self.n_features]
                
        context_vector = context_vector.reshape(-1, 1)
        self.A[arm] += context_vector.dot(context_vector.T)
        self.b[arm] += reward * context_vector

bandit_instance = CausalBandit()

def decide_intervention(context_dict):
    """
    Called by the API when evaluating a PDP view.
    Returns intervention type string.
    """
    # Build continuous feature vector from context
    features = [
        context_dict.get('prior_product_views', 0),
        context_dict.get('prior_cart_adds', 0),
        context_dict.get('prior_searches', 0),
        context_dict.get('session_duration_so_far_s', 0),
        context_dict.get('price_rank_in_session', 0),
        context_dict.get('price_vs_median_pct', 0) if context_dict.get('price_vs_median_pct') is not None else 0,
        1 if context_dict.get('is_most_expensive_seen') else 0,
        1 if context_dict.get('is_cheapest_seen') else 0,
        context_dict.get('time_on_page_before_ms', 0) / 1000.0,
        context_dict.get('scroll_depth_pct', 0) / 100.0,
        context_dict.get('scroll_velocity_avg', 0),
        context_dict.get('micro_hesitations', 0),
        context_dict.get('same_category_views_before', 0),
        1 if context_dict.get('is_return_view') else 0,
        1 if context_dict.get('is_from_search') else 0
    ]
    
    vec = np.array(features)
    arm = bandit_instance.get_action(vec)
    
    mapping = {
        0: "NONE",
        1: "COMPARE_MATRIX",
        2: "PRICE_REFRAME"
    }
    
    return mapping.get(arm, "NONE")
