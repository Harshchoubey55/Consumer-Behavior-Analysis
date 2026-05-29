/**
 * local_model.ts
 * ==============
 * Client-side logistic regression for FedAvg-inspired federated behavioral phenotyping.
 *
 * What this does:
 *   1. Initializes from the server's global model weights (fetched on page load).
 *   2. As the user browses, accumulates (features, label) training pairs from
 *      decision context snapshots: each product view is one sample, label=1 if
 *      the user added it to cart during the session, 0 otherwise.
 *   3. On session end (beforeunload), runs 3 SGD passes over the session data.
 *   4. Computes Δw = w_local - w_global.
 *   5. Sends a sparse-compressed Δw to /api/fedavg-update.
 *      Raw events are NEVER sent — only the gradient delta.
 *
 * What this is NOT:
 *   - Full federated learning with cryptographic privacy.
 *   - A production ML model — 15 parameters on 3-10 samples per session
 *     won't converge to a useful classifier. The VALUE is in the aggregate
 *     across many sessions, not in any individual model.
 *
 * Implementation:
 *   Pure TypeScript logistic regression. Zero dependencies.
 *   A 15-parameter LR is trivial: sigmoid(w·x), SGD update w += η*(y-ŷ)*x
 */

const ANALYTICS_API = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || 'http://localhost:3001';

// ── Feature names (must match FEATURE_NAMES in fedavg_aggregator.py) ────────
export const FEATURE_NAMES = [
  'prior_product_views',   // 0
  'prior_cart_adds',       // 1
  'prior_searches',        // 2
  'session_duration_s',    // 3
  'price_rank_in_session', // 4
  'price_vs_median_pct',   // 5
  'is_most_expensive',     // 6
  'is_cheapest',           // 7
  'scroll_depth_pct',      // 8
  'time_on_page_s',        // 9
  'is_from_search',        // 10
  'is_return_view',        // 11
  'same_category_views',   // 12
  'hour_of_day',           // 13
  'scroll_velocity',       // 14
] as const;

export const N_FEATURES = FEATURE_NAMES.length;

const LEARNING_RATE = 0.01;
const SGD_EPOCHS    = 3;
const TOP_K_SPARSE  = 7;     // send only the 7 largest gradient components
const SESSIONKEY_WEIGHTS = '_ba_global_w';

type DecisionSample = {
  features: number[];   // length N_FEATURES
  label: number;        // 1 = added to cart later, 0 = viewed without adding
};

// ── Math helpers ──────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalize(features: number[]): number[] {
  // Simple per-feature clipping + scale to [-1, 1] range
  const scales = [10, 5, 5, 3600, 10, 200, 1, 1, 100, 300, 1, 1, 10, 24, 1000];
  return features.map((v, i) => Math.max(-1, Math.min(1, v / (scales[i] || 1))));
}

// ── Local Model class ─────────────────────────────────────────────────────────

class LocalModel {
  private w: number[];          // current local weights
  private wGlobal: number[];    // global weights at session start (for Δw)
  private samples: DecisionSample[] = [];
  private sessionId: string = '';

  constructor() {
    this.w = Array(N_FEATURES).fill(0);
    this.wGlobal = Array(N_FEATURES).fill(0);
  }

  /** Load global weights from sessionStorage cache (set on page load). */
  initFromStorage(): void {
    try {
      const stored = sessionStorage.getItem(SESSIONKEY_WEIGHTS);
      if (stored) {
        const parsed = JSON.parse(stored) as number[];
        if (parsed.length === N_FEATURES) {
          this.w = [...parsed];
          this.wGlobal = [...parsed];
        }
      }
    } catch {
      // sessionStorage unavailable (SSR or privacy mode) — use zeros
    }
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }

  /**
   * Add a training sample from a product view.
   * Call this when a product is viewed; update label when cart event fires.
   */
  addSample(contextFeatures: Record<string, number | boolean | null>): void {
    const features = FEATURE_NAMES.map(name => {
      const v = contextFeatures[name];
      if (v === null || v === undefined) return 0;
      return typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0;
    });
    this.samples.push({ features: normalize(features), label: 0 });
  }

  /** Mark the most recent sample as a cart-add (label = 1). */
  markLastAsCartAdd(): void {
    if (this.samples.length > 0) {
      this.samples[this.samples.length - 1].label = 1;
    }
  }

  /** Run SGD and compute Δw. Returns true if update is worth sending. */
  computeUpdate(): { indices: number[]; values: number[]; nSamples: number } | null {
    if (this.samples.length < 3) return null; // not enough data for a meaningful gradient

    // SGD training
    const w = [...this.w];
    for (let epoch = 0; epoch < SGD_EPOCHS; epoch++) {
      for (const { features, label } of this.samples) {
        const pred = sigmoid(dot(w, features));
        const err  = label - pred;
        for (let j = 0; j < N_FEATURES; j++) {
          w[j] += LEARNING_RATE * err * features[j];
        }
      }
    }

    // Δw = w_local_trained - w_global
    const delta = w.map((wi, i) => wi - this.wGlobal[i]);

    // Sparse compression: keep top-K by absolute value
    const indexed = delta.map((v, i) => ({ i, v }));
    indexed.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const topK = indexed.slice(0, TOP_K_SPARSE).filter(x => Math.abs(x.v) > 1e-6);

    if (topK.length === 0) return null;

    return {
      indices:  topK.map(x => x.i),
      values:   topK.map(x => parseFloat(x.v.toFixed(6))),
      nSamples: this.samples.length,
    };
  }

  /** Send gradient delta to the analytics API. */
  async sendUpdate(sessionId: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const update = this.computeUpdate();
    if (!update) return;

    try {
      await fetch(`${ANALYTICS_API}/api/fedavg-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:    sessionId,
          n_samples:     update.nSamples,
          delta_indices: update.indices,
          delta_values:  update.values,
        }),
        keepalive: true, // survive beforeunload
      });
    } catch {
      // Non-fatal — fedavg updates are best-effort
    }
  }

  getSampleCount(): number {
    return this.samples.length;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const localModel = new LocalModel();

// ── Bootstrap: fetch global weights on first load ─────────────────────────────
export async function initGlobalModel(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const res = await fetch(`${ANALYTICS_API}/api/global-model`, {
      cache: 'no-store',
    });
    if (!res.ok) return;

    const data = await res.json();
    if (Array.isArray(data.weights) && data.weights.length === N_FEATURES) {
      sessionStorage.setItem(SESSIONKEY_WEIGHTS, JSON.stringify(data.weights));
      localModel.initFromStorage();
    }
  } catch {
    // Gracefully degrade — localModel uses zeros
    localModel.initFromStorage();
  }
}
