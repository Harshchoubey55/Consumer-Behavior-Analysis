# ZeroError — Full Project Analysis, Bug Report & FedAvg Integration Proposal

> Senior AI/ML + Data Analyst + Full-Stack Engineer review of all versions.
> Version order: v3 → v4 → v5 → Antigravity → **H (latest, current)**

---

## 1. VERSION EVOLUTION — WHAT CHANGED ACROSS EACH

### v3 (baseline)

The first complete system. Established the architectural skeleton that all later versions build on:

- **Storefront** (Next.js 14, port 3000), **Analytics API** (Node.js, port 3001), **Dashboard** (Next.js, port 3002), **Python Engine** (Docker background service), **PostgreSQL 16**
- Python pipeline with 8 stages: sessionize → product analytics → user features → KPIs → funnel → recommendations → **Markov sequence modeling** → **Contextual Decision Reconstruction**
- The genuinely novel layer: `context_analyzer.py` reconstructs the decision environment at each product view (how many products seen before, price anchoring, scroll depth, session duration) and computes context-conditional conversion rates per product × context bin, validated by chi-squared tests
- `sequence_modeler.py`: first-order Markov chains over behavioral states, producing transition matrices, per-edge conversion lift, path mining, and a real-time `/api/score` endpoint
- No causal bandit, no intervention provider, no cinematic UI

### v4 (diff-only patch)

A focused scientific rigor upgrade. Added exactly 6 files on top of v3:

- `evaluation_engine.py`: replaced the Markov chain as a "predictive model" with proper **Logistic Regression + Random Forest**, train/test split, AUC-ROC, statsmodels p-values on coefficients, feature importance via permutation. Wrote results to `model_evaluation_results`, `model_coefficients`, `feature_importance`, `behavioral_effects` tables
- Added `/api/analytics/evaluation` route, added `evaluation` dashboard page
- The research question it answers: _"Do context-aware features outperform count-only features for conversion prediction, and are price anchoring / comparison fatigue effects statistically significant?"_

### v5 (claude_max)

Added the most intellectually interesting novel feature across all versions:

- `phenotype_classifier.py`: **Unsupervised behavioral archetype discovery**. K-Means clustering over session-level aggregates of decision context features, with silhouette score optimization for K (range 2–6), greedy centroid-based phenotype naming (Deal Seeker, Comparison Shopper, Focused Browser, Intent-Driven, Deliberate Researcher), and one-way ANOVA + post-hoc validation that conversion rates differ significantly across phenotypes
- Added `006_phenotypes.sql` (two tables: `session_phenotypes`, `phenotype_profiles`), `/api/analytics/phenotypes` route, phenotypes dashboard chart
- Also added a `/study` page in the storefront — presumably for academic/demo context
- The behavioral economics citations in the code (Shiv & Fedorikhin 1999, Iyengar & Lepper 2000, Ariely 2003) suggest this was being built with research credibility in mind

### Antigravity (UI overhaul + causal bandit)

The most visually dramatic version:

- **ScrollytellingHero.tsx**: 1200vh scrollable container with Framer Motion's `scrollYProgress`, a 10-category radial wheel where items arc in/out based on scroll position, product images with `mix-blend-screen` on pure black background, dramatic radial vignette overlay
- **`causal_bandit.py`**: LinUCB contextual bandit with 3 arms (NONE / COMPARE_MATRIX / PRICE_REFRAME), 15-feature context vector built from the tracker's decision context data, warm-start priors seeded from domain knowledge
- **`InterventionProvider.tsx`**: Real-time UI adaptation, showing either a product comparison modal (COMPARE_MATRIX) or a value-reframing nudge (PRICE_REFRAME) based on risk score
- HD product image library (34 transparent PNGs)

### H (latest — current working version)

The most complete merged version. Integrates everything from Antigravity's UI + bandit with the core analytics pipeline from v3/v4, and adds:

- `AuthProvider` (localStorage mock auth with guest-first → optional identity merge)
- `CartProvider` (localStorage cart with quantity management)
- New storefront app pages: `/cart`, `/checkout`, `/admin`, `/signin`, `/wishlist`
- The full `tracker.ts` with micro-hesitation tracking, scroll velocity, decision context construction, `onRiskUpdate` callback, and `getDecisionContext()` computing price anchoring features client-side
- `score/route.ts` with in-memory Markov matrix cache, timing + loop adjustments, and fixed-probability randomized assignment (50/25/25)
- `run_intervention_pipeline()` in `causal_bandit.py` — the reward backfill loop that patches `intervention_logs` with outcomes when purchases are detected
- **Regression from v5**: `phenotype_classifier.py` and `006_phenotypes.sql` are not present

---

## 2. BUGS — CRITICAL TO MINOR

### 🔴 CRITICAL: React Hooks Violation in `ScrollytellingHero.tsx`

**File**: `storefront/components/ui/ScrollytellingHero.tsx`, lines 46–50 and 93–94

```typescript
// BROKEN — hooks called inside .map()
{categories.map((cat) => {
  const distance = useTransform(smoothProgress, (p) => p - cat.centerIndex);  // ← ILLEGAL
  const y = useTransform(distance, [-0.5, 0, 0.5], [800, 0, -800]);           // ← ILLEGAL
  const opacity = useTransform(distance, [-0.15, 0, 0.15], [0, 1, 0]);        // ← ILLEGAL
  ...
})}
```

React's Rules of Hooks forbid calling hooks inside loops, callbacks, or conditional branches. This will throw: `"React Hook 'useTransform' cannot be called inside a callback. React Hooks must be called in a React function component or a custom React Hook function."` The hero will not render at all in strict mode, and will produce unpredictable behavior in production.

**Fix**: Extract each category into its own component that calls hooks at the top level:

```typescript
function CategorySlide({
  cat,
  smoothProgress
}: {
  cat: Category;
  smoothProgress: MotionValue<number>;
}) {
  const distance = useTransform(smoothProgress, (p) => p - cat.centerIndex);
  const y = useTransform(distance, [-0.5, 0, 0.5], [800, 0, -800]);
  const x = useTransform(distance, [-0.5, 0, 0.5], [-120, 20, -120]);
  const opacity = useTransform(distance, [-0.15, 0, 0.15], [0, 1, 0]);
  const scale = useTransform(distance, [-0.15, 0, 0.15], [0.6, 1, 0.6]);
  // ... render
}

// In ScrollytellingHero:
{
  categories.map((cat) => <CategorySlide key={cat.id} cat={cat} smoothProgress={smoothProgress} />);
}
```

Same fix needed for the right-side image panel (lines 75–100).

---

### 🔴 CRITICAL: CausalBandit State Not Persisted — Resets on Every Restart

**File**: `analytics-engine/processors/causal_bandit.py`, line `bandit_instance = CausalBandit()`

The LinUCB `A` matrices and `b` vectors are pure in-memory numpy arrays. Every time the Docker container restarts (which happens on every `docker compose up`), the bandit forgets everything it learned. This makes it permanently a warm-started random assignment engine, not an adaptive one.

**Fix**: Serialize bandit state to the database after each update:

```python
def save_state(self, conn):
    state = {
        'A': [A.tolist() for A in self.A],
        'b': [b.tolist() for b in self.b],
    }
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO bandit_state (state_json, updated_at)
            VALUES (%s, NOW())
            ON CONFLICT (id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
        """, [json.dumps(state)])
    conn.commit()

@classmethod
def load_state(cls, conn):
    bandit = cls()
    with conn.cursor() as cur:
        cur.execute("SELECT state_json FROM bandit_state ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        if row:
            state = json.loads(row['state_json'])
            bandit.A = [np.array(a) for a in state['A']]
            bandit.b = [np.array(b) for b in state['b']]
    return bandit
```

---

### 🟠 HIGH: Bandit Is Disconnected from the Score API

The Python `causal_bandit.py` has a `decide_intervention(context_dict)` function that runs LinUCB, but **`score/route.ts` never calls it**. The score API uses a hardcoded `assignArm()` with fixed 50/25/25 probabilities. The bandit is only used in `run_intervention_pipeline()` which is a reward backfill step — not the assignment step.

This means: the Python bandit learns nothing (its update loop never fires from real decisions), and the Node.js API always does fixed random assignment. These two systems don't talk to each other.

**Two valid fixes:**

1. **Make it a proper RCT** (simpler, statistically cleaner): Keep the fixed assignment and remove the bandit entirely from the live path. Use IPW/CATE to evaluate treatment effects. The current `score/route.ts` actually does this correctly — the bandit is the unnecessary complication.
2. **Actually connect the bandit**: Have `score/route.ts` call a `/decide` Python FastAPI endpoint that runs LinUCB and returns the arm. Then reward updates go back via a `/update` endpoint after purchase events. This is viable but adds latency and a cross-service dependency.

For a **research platform** the first option is cleaner: fixed assignment + causal evaluation is more defensible than an adaptive bandit that needs many more samples to converge.

---

### 🟠 HIGH: `init.sql` and `001_schema.sql` Are Out of Sync (Two-Schema Problem)

H has both `init.sql` (in `active_project/`) and `analytics-engine/sql/001_schema.sql`. They define **completely different table structures** for the same concepts:

- `init.sql` has `ab_assignments` (simple A/B table); `001_schema.sql` has `intervention_logs` (the correct full table with `propensity`, `outcome`, `outcome_updated_at`)
- `init.sql` has no `markov_transitions`, `decision_contexts`, `session_risk_log`, or any of the Markov/context tables
- The Docker Compose mounts `001_schema.sql` as the init file, so `init.sql` is dead code in Docker — but `scripts/init-db.js` (for Vercel) presumably references `init.sql`

If someone uses `init-db.js` to set up a cloud database, it will be missing ~80% of the schema and every query in the analytics pipeline will fail silently.

**Fix**: Delete `init.sql`. Replace `scripts/init-db.js` to concatenate and run all five SQL files in order (001→005).

---

### 🟠 HIGH: InterventionProvider Modals Never Render — `currentProduct` Never Gets Set

**File**: `storefront/components/tracking/InterventionProvider.tsx`

The COMPARE_MATRIX and PRICE_REFRAME interventions render only when `currentProduct !== null`. The `setCurrentProduct` setter is exported via context. But in the codebase there is no component that calls `setCurrentProduct` when a user visits a product page.

`page-tracker.tsx` only calls `tracker.pageView(pathname)`. `product-view-tracker.tsx` tracks views but doesn't call `setCurrentProduct`.

The result: `intervention` gets set by `onRiskUpdate`, the modals exist in the DOM, but `currentProduct` is always `null`, so both conditionals (`intervention === 'COMPARE_MATRIX' && currentProduct`) are always false. **No intervention modal ever shows.**

**Fix**: In the product detail page or `ProductViewTracker`, call:

```typescript
const { setCurrentProduct } = useIntervention();
setCurrentProduct({ id, name, price, category, features });
```

---

### 🟠 HIGH: `intervention_logs` Query Uses Potentially Nonexistent Column

**File**: `analytics-api/app/api/analytics/interventions/route.ts`

The SQL:

```sql
AVG(CASE WHEN outcome_updated THEN outcome::numeric ELSE NULL END) AS empirical_conversion_rate
```

The `001_schema.sql` defines `outcome_updated_at TIMESTAMPTZ` (a timestamp), not a boolean column named `outcome_updated`. The expression `WHEN outcome_updated` (treating a timestamp as a boolean) will silently return null or throw a type error depending on PostgreSQL version.

**Fix**: Change to:

```sql
AVG(CASE WHEN outcome_updated_at IS NOT NULL THEN outcome::numeric ELSE NULL END)
```

---

### 🟡 MEDIUM: AuthProvider Stores Passwords in Plaintext in localStorage

**File**: `storefront/components/auth/AuthProvider.tsx`, line 59

```typescript
db[email] = { name, email, password, userId: newUserId };
localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
```

Anyone who opens DevTools can read all users' passwords. The `PROJECT_TECHNICAL.md` acknowledges this as a deliberate choice ("prevent unnecessary exposure of sensitive user data on cloud platforms") but frames it incorrectly — storing plaintext passwords in localStorage is _more_ exposed than a bcrypt hash in a real database. For behavioral data collection at scale (which is the stated purpose), this means all participants' credentials are compromised by default.

**Fix**: Since it's already client-side only, at minimum hash with SHA-256 before storing:

```typescript
const hashedPw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
db[email] = {
  name,
  email,
  password: Array.from(new Uint8Array(hashedPw))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
};
```

---

### 🟡 MEDIUM: Markov Matrix Cache Dies on Serverless Cold Starts

**File**: `analytics-api/app/api/score/route.ts`, lines `let matrixCache = null`

The cache is a module-level variable. In serverless/Vercel deployments, functions are stateless — every cold start re-fetches the matrix from the DB. Under high traffic, this hammers the database. Under low traffic on a cold Vercel function, the first user's scoring call adds ~200-500ms latency.

**Fix**: Use an external cache (Redis via Upstash free tier), or cache in-DB with a computed-at timestamp and refresh it via the Python pipeline rather than per-request.

---

### 🟡 MEDIUM: v5's Phenotype Classifier Was Dropped from H

`phenotype_classifier.py` (K-Means behavioral clustering) and `006_phenotypes.sql` (two new tables) exist in v5 but are absent from H. The `pipeline.py` in H doesn't call `run_phenotype_pipeline`. This is a regression — phenotype discovery was the most novel analytical contribution in v5 and costs nothing to carry forward since it runs offline.

**Fix**: Copy `phenotype_classifier.py` from v5 into H's `analytics-engine/processors/`, add `006_phenotypes.sql` to the SQL init sequence, and add to `pipeline.py`:

```python
from phenotype_classifier import run_phenotype_pipeline
# In run_pipeline() under 'full' mode:
run_phenotype_pipeline(conn)
```

---

### 🟡 MEDIUM: Tracker's Decision Context Goes Into `properties` Field, Not `context-events`

The README lists a `/api/context-events` endpoint for enriched context events. But `tracker.ts` sends the full decision context (price anchoring, scroll depth, prior views, etc.) inside the `properties` field of the standard `/api/events` route. The `context-events` route either doesn't exist in H or isn't being used.

This means the `decision_contexts` table (populated by the Python `context_analyzer.py` from the raw `events` table) has to parse a JSON blob inside `properties` rather than receiving structured context. This works but is fragile — if the `properties` key names change on the frontend, the Python extractor silently gets nulls.

**Fix**: Either formalize the `/api/context-events` endpoint that writes directly into `decision_contexts`, or document that `context_analyzer.py` is the exclusive consumer of `properties.context_data` and pin its structure.

---

### 🟢 MINOR: ScrollytellingHero Images Reference Nonexistent Category Slugs

The hero links to `/search?q=fashion`, `/search?q=accessories`, etc. But the actual storefront search likely expects `category=fashion` or a product catalog slug. If the search page doesn't handle the `q` param as a category filter, all 10 "Explore Series" buttons are broken links that return empty results.

---

### 🟢 MINOR: `causal_bandit.py` Features Index 5 Out of Bounds Risk

```python
def _seed_priors(self):
    self.b[1][0] = 0.5   # fine
    self.b[2][5] = 0.5   # assumes feature index 5 is "price_vs_median_pct"
```

The feature vector is built in `decide_intervention()`. If someone reorders those features (e.g., during a refactor), index 5 no longer refers to `price_vs_median_pct`. Use named constants:

```python
FEATURES = ['prior_product_views', 'prior_cart_adds', 'prior_searches',
            'session_duration_s', 'price_rank', 'price_vs_median_pct', ...]
PRICE_VS_MEDIAN_IDX = FEATURES.index('price_vs_median_pct')
self.b[2][PRICE_VS_MEDIAN_IDX] = 0.5
```

---

## 3. WHAT IS ACTUALLY NOVEL (AND WHAT ISN'T)

### Genuinely Novel

**Contextual Decision Reconstruction (`context_analyzer.py`)** — This is the core genuine contribution across all versions. The idea that the same product seen 1st in a session converts at 31% but seen 8th converts at 3% is not a new observation in academic literature, but implementing it as a live, real-time system that:

1. Reconstructs the decision environment at each event timestamp
2. Computes context-conditional rates per `(product, context_bin)` pair
3. Chi-squared tests to filter noise
4. Auto-generates plain-language insight labels (comparison_fatigue, price_anchor_high, first_impression, etc.)
   ...is legitimately novel for an applied system and not something you get from Mixpanel or Amplitude.

**Behavioral Phenotype Discovery (v5's `phenotype_classifier.py`)** — Segmenting users by _behavioral decision style_ (not demographics, not acquisition channel) using unsupervised clustering, then validating with ANOVA that the phenotypes have statistically different conversion rates — this is novel for a consumer analytics product. The academic grounding is solid. **This should not have been dropped from H.**

**Real-Time Session Risk Scoring with Markov Forward Pass** — The `computeConversionProbability()` function does a depth-5 forward pass over the transition matrix to compute expected conversion probability from the current state. This is clean and works in <1ms, making real-time intervention feasible. Most commercial tools only give you historical funnel conversion rates, not a live probability estimate for a current session prefix.

### Not Really Novel (Honest Assessment)

**The CausalBandit / LinUCB** — LinUCB is a well-known algorithm from Li et al. (2010). Applying it to A/B test variants is standard practice at any mid-size tech company. The novelty claim here is the _feature space_ (decision context features as the context vector), which is interesting but the implementation has the critical bug of not persisting state, so it's never actually learning anything.

**IPW/CATE** — These are standard causal inference techniques. Running them over a randomized experiment is methodologically correct but not novel. The value is in doing it _right_ (using the fixed-probability propensity scores for IPW validity), which the current code does.

**Markov Chain Sequences** — First-order Markov chains over event sequences have been used in web analytics since the 2000s. The implementation here is clean and practical, but it's not a research contribution. It's a well-implemented standard technique.

**The Scrollytelling UI** — Very polished. Apple-grade aesthetic. But this is a UX exercise, not a behavioral analytics contribution. The risk is that it becomes the _identity_ of the project when the behavioral engine is the actual thing worth showing.

---

## 4. THE FEDAVG / FEDERATED LEARNING PAPER — APPLICABILITY & PROPOSAL

### What the Paper Does

McMahan et al. (2017) introduce **FedAvg**: instead of centralizing all training data, each client (mobile device) trains a local model update on its own data, then sends only the gradient/model update to a central server that aggregates them via weighted averaging. Key results: 10–100× reduction in communication rounds vs. synchronized SGD, robust to non-IID and unbalanced data distributions.

### Is It Applicable Here?

**In standard deployment: no, not really.** Your platform is a centralized web app. You have one server, one DB, one analytics pipeline. Federated learning's core motivation is that you _can't_ centralize the data (privacy, device ownership, bandwidth). That constraint doesn't exist here — you do centralize events.

**Where it becomes genuinely interesting:** If this platform is deployed as a _research instrument_ collecting behavioral data from real users who don't consent to having their browsing behavior uploaded, or if it scales to a point where ingesting every scroll event becomes prohibitive, federated learning becomes relevant.

### Proposed Novel Architecture: Federated Behavioral Phenotyping

Here is a concrete, viable integration inspired by FedAvg that adds real novelty:

**The Core Idea:** Instead of sending every behavioral event to the server, each user's browser trains a _local micro-model_ (a lightweight logistic regression or a small representation) on their own session data, then only sends a compressed model update to the server. The server aggregates these updates via FedAvg to maintain a global behavioral model, which is then used for phenotype assignment and intervention decisions. Raw behavioral data never leaves the browser.

**Architecture:**

```
Browser (Client k)
├── tracker.ts — collects events, scroll depth, hesitations
├── local_model.ts — lightweight LR trained on client's own session history
│   ├── Features: prior_views, price_vs_median, scroll_depth, time_on_page...
│   └── Label: added_to_cart (binary)
├── gradient_delta = local_model.compute_update(session_data)
└── POST /api/model-update { delta: compressed_gradient, propensity: ... }

Analytics API
├── FedAvg aggregation: w_global ← weighted average of client updates
└── Broadcast updated global weights back to clients on next page load

Analytics Engine (Python)
├── Uses global weights for offline phenotype assignment
├── Computes CATE on aggregated (not raw) updates
└── Differential privacy noise injection (optional) on aggregated gradients
```

**Why this is viable for this specific project:**

1. The feature vector is already computed client-side in `tracker.ts`'s `getDecisionContext()`. You're already doing the hard part.
2. The "model update" can be as simple as a gradient from a 15-parameter logistic regression trained on that session's events. That's a 15-float vector — trivially small to transmit.
3. The server aggregation (FedAvg) is a weighted mean of these vectors, which is also trivial to implement.
4. The **research value**: you can claim that users' raw behavioral data stays on-device, only statistical updates are shared, and you can still recover global behavioral patterns. This directly addresses privacy concerns about tracking micro-interactions.

**Proposed FedAvg Integration — Detailed Framework:**

```
Phase 1: Client-side micro-training (JavaScript, browser)
─────────────────────────────────────────────────────────
After session ends (beforeunload), tracker.ts:
  1. Collects all decision_context snapshots from the session
  2. Runs E=3 passes of SGD on local LR model (15 features → 1 output)
  3. Computes weight delta: Δw = w_local - w_global
  4. Compresses delta (e.g., top-k sparsification: keep only 5 of 15 values)
  5. POST /api/fedavg-update { session_id, delta: [sparse_indices, sparse_values], n_samples: k }

Phase 2: Server aggregation (Node.js)
──────────────────────────────────────
/api/fedavg-update collects deltas in a staging table.
Python pipeline (new stage 9) every 15 minutes:
  1. Loads pending deltas: SELECT * FROM fedavg_updates WHERE applied = false
  2. FedAvg: w_global ← w_global + (Σ nk * Δwk) / (Σ nk)
  3. Optionally: add Gaussian noise σ² (differential privacy) before writing
  4. Writes updated w_global to global_model table
  5. Marks deltas as applied

Phase 3: Global model broadcast (on page load)
───────────────────────────────────────────────
storefront/app/layout.tsx fetches /api/global-model and stores in sessionStorage.
tracker.ts initializes local_model from global weights rather than random init.
This gives FedAvg's shared initialization property (which is why it works).

Phase 4: Federated Phenotyping (Python)
────────────────────────────────────────
Instead of clustering raw decision_contexts rows (current approach),
cluster the per-session weight vectors Δwk.
These are already in the DB (from Phase 2's staging table).
Each user's behavioral decision style is now represented as a vector
in the model parameter space — not a bag of raw features.
This is more compact, more private, and can be updated incrementally.

Evaluation
──────────
Baseline: current centralized model (all data pooled)
FedAvg model: trained only on gradients, no raw data
Compare: AUC-ROC on held-out conversion prediction
Claim: "We achieve X% of centralized performance with zero raw data upload"
```

**Realistic assessment of effort:** Phase 1 (client-side micro-training) is the hardest part. A 15-parameter logistic regression in JavaScript with 3 SGD passes is ~40 lines of code — completely doable. Phases 2–3 are straightforward. Phase 4 replaces the existing phenotype clustering with a cleaner approach.

**The novelty claim would be:** _"Federated Behavioral Phenotyping — inferring consumer decision style archetypes from on-device gradient updates without centralizing raw interaction data."_ This is a legitimate research contribution that doesn't exist in published literature in this form.

**What this isn't:** This is NOT the full FedAvg setup with hundreds of mobile clients in a privacy-preserving training loop. It's an architectural adaptation for a web analytics context. Be precise about this framing. Calling it "inspired by FedAvg" and citing the paper is fine; calling it "federated learning" without qualification overstates it.

---

## 5. PRIORITY FIX LIST

| Priority        | File                                      | Issue                                               |
| --------------- | ----------------------------------------- | --------------------------------------------------- |
| 🔴 Fix now      | `ScrollytellingHero.tsx`                  | Hooks inside `.map()` — app won't render            |
| 🔴 Fix now      | `causal_bandit.py`                        | No state persistence — bandit never actually learns |
| 🟠 Fix soon     | `score/route.ts` + `causal_bandit.py`     | Bandit disconnected from live assignment            |
| 🟠 Fix soon     | `init.sql` vs `001_schema.sql`            | Schema fragmentation breaks cloud deployment        |
| 🟠 Fix soon     | `InterventionProvider.tsx` + product page | `currentProduct` never set — modals never show      |
| 🟠 Fix soon     | `interventions/route.ts`                  | `outcome_updated` column name wrong                 |
| 🟡 Next sprint  | `pipeline.py`                             | Re-add `phenotype_classifier` (dropped from v5)     |
| 🟡 Next sprint  | `AuthProvider.tsx`                        | Plaintext password in localStorage                  |
| 🟡 Next sprint  | `score/route.ts`                          | Markov cache dies on serverless cold starts         |
| 🟢 Nice to have | `causal_bandit.py`                        | Feature index magic numbers → named constants       |
| 🟢 Nice to have | `ScrollytellingHero.tsx`                  | Category slugs must match search route format       |

---

## 6. WHAT TO DO WITH THE BEHAVIOR ANALYSIS LAYER (THE ACTUAL GOAL)

You said you don't want "yet another e-commerce platform." Here is what makes this platform's behavioral intelligence layer genuinely worth building and differentiating:

**The system you actually have (and should double down on):**

1. **Decision Context Reconstruction** — already works, already novel. The insight types (comparison_fatigue, price_anchor_high, first_impression) are actionable and not available in any off-the-shelf tool. Strengthen this: add category_entropy as a context dimension (how spread-out the user's browsing was before viewing this product).

2. **Behavioral Phenotyping** — bring back from v5, fix the pipeline gap. The ANOVA validation makes it scientifically defensible. Once you have phenotypes, you can do phenotype-specific interventions: don't show the PRICE_REFRAME nudge to an Intent-Driven user (they already know what they want) — show it to a Deal Seeker.

3. **Causal Intervention Evaluation** — the fixed-probability RCT + IPW/CATE is the right approach. The math is there. Fix the intervention rendering bug first so you're actually running the experiment.

**Three additions that would make the analytics genuinely stronger:**

1. **Cross-Session Behavioral Drift**: Track how a user's decision style changes across sessions. Does a Comparison Shopper become more Intent-Driven over time (as they learn the catalog)? This requires a user_id linkage across sessions — which the auth system (even the mock one) enables.

2. **Price Sensitivity Calibration**: The `price_vs_median_pct` feature gives relative price position. Add an absolute sensitivity score: how many price comparisons does this user make before adding to cart at each price tier? This feeds directly into intervention arm selection.

3. **Anomaly Detection on Session Paths**: The sequence modeler's anomaly detection (sequences with low cumulative Markov probability) is implemented but not surfaced anywhere on the dashboard. Add a "Suspicious Sessions" view — sessions that followed no known path are either UX bugs, confused users, or interesting behavioral outliers worth studying.
