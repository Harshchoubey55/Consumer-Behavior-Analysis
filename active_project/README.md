# Consumer Behavior & Pattern Analysis System — v3

An end-to-end behavioral intelligence platform. Captures user interactions,
reconstructs the full decision context at each moment, models sessions as
sequences, applies predictive models, and surfaces insights through a dashboard.

## What makes this different

Most analytics tools tell you **what** users did. This tells you **why** —
by reconstructing the full situational context at the moment every decision
was made.

### Contextual Decision Reconstruction (the novel layer)
When a user views a product and doesn't add to cart, standard analytics records
one event. This system also records: how many other products they had seen,
what prices they had been exposed to, how expensive this product looked relative
to their session's price history, how long they spent on the page, how far they
scrolled, and whether they arrived via search or browse.

It then computes context-conditional conversion rates — for each product, how
does the conversion rate change depending on context? The same product viewed
first might convert at 31%. Viewed after 5 others: 8%. That 4x difference is
caused entirely by context and is invisible to aggregate metrics.

Statistical significance is tested with chi-squared tests so only real effects
are surfaced, not noise. Plain-language contrastive insights are generated
automatically, classified by type: comparison_fatigue, price_anchor_high,
first_impression, attention_depth, search_intent, category_saturation, etc.

### Sequential Behavioral Modeling
Sessions are modeled as Markov chains, not event counts. Produces transition
probabilities, per-transition conversion lift, common path mining, and anomaly
detection on sessions with low-probability paths.

### Real-time In-Session Risk Scoring
The tracker calls /api/score after every state transition. The Markov-based
scorer returns abandonment probability for the current sequence prefix.
Hook into it with tracker.onRiskUpdate(callback).

## Quickstart (Docker)

```bash
docker compose up --build
# Dashboard:   http://localhost:3002
# Storefront:  http://localhost:3000
# API:         http://localhost:3001
```

## Quickstart (manual)

```bash
# Database
psql -U postgres -c "CREATE DATABASE analytics_db;"
psql -U postgres -d analytics_db -f analytics-engine/sql/001_schema.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/002_seed.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/003_sequences.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/004_context.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/005_context_seed.sql

# Analytics API (port 3001)
cd analytics-api && cp .env.example .env && npm install && npm run dev

# Python pipeline
cd analytics-engine
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python processors/pipeline.py --mode=full

# Dashboard (port 3002)
cd dashboard && cp .env.example .env && npm install && npm run dev

# Storefront (port 3000)
cd storefront && cp .env.example .env && npm install && npm run dev
```

## Pipeline stages

1. refresh_sessions — sessionize raw events
2. refresh_product_analytics — per-product engagement
3. compute_user_features — RFM + churn + engagement scores
4. refresh_daily_kpis — time-series snapshots
5. refresh_funnel — conversion funnel state
6. generate_recommendations — prescriptive rules
7. run_sequence_pipeline — Markov chains + path mining + risk scoring
8. run_context_pipeline — contextual decision reconstruction (novel)

## Deployment (all free)

Storefront + Dashboard on Vercel (free tier).
Analytics API + Python Engine + PostgreSQL on Fly.io (free tier).
See deployment guide for Windows step-by-step instructions.

## License

MIT
