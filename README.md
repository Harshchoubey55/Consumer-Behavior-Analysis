<![CDATA[<div align="center">

<!-- Animated header using capsule render -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:6e40c9&height=230&section=header&text=Consumer%20Behavior%20%26%20Pattern%20Analysis&fontSize=36&fontColor=ffffff&fontAlignY=35&desc=Real-time%20Cognitive%20Adaptive%20Analytics%20%E2%80%A2%20Causal%20ML%20%E2%80%A2%20Behavioral%20Intelligence&descSize=16&descAlignY=55&animation=fadeIn" width="100%"/>

<br/>

<!-- Animated typing effect -->
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=22&duration=3000&pause=1000&color=A78BFA&center=true&vCenter=true&multiline=true&repeat=true&width=700&height=80&lines=Most+analytics+tell+you+WHAT+users+did.;This+tells+you+WHY+%E2%80%94+with+causal+ML." alt="Typing SVG" /></a>

<br/>

<!-- Tech badges -->
<p>
<img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"/>
<img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
<img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
<img src="https://img.shields.io/badge/MedusaJS-v2-7C3AED?style=for-the-badge&logo=medusa&logoColor=white" alt="MedusaJS"/>
<img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
<img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
</p>

<!-- Status badges -->
<p>
<img src="https://img.shields.io/badge/status-active%20development-brightgreen?style=flat-square" alt="Status"/>
<img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"/>
<img src="https://img.shields.io/badge/PRs-welcome-ff69b4?style=flat-square" alt="PRs Welcome"/>
</p>

</div>

---

## 🧠 What Is This?

An **end-to-end behavioral intelligence platform** built on top of a real MedusaJS e-commerce store. It captures every user micro-interaction, reconstructs the **full decision context** at each moment, models sessions as **Markov chains**, applies **causal machine learning**, and surfaces insights through a research-grade dashboard.

> **The Novel Contribution:** Standard analytics records that a user viewed a product and didn't buy.  
> This system also records *how many products they'd already seen, what prices they'd been exposed to, how expensive this product looked relative to their session history, how long they hesitated, and whether they arrived via search or browse* — then uses causal ML to determine **why** they didn't convert and **intervenes in real-time** to change the outcome.

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "👤 Customer Layer"
        SF["🛍️ Instrumented Storefront<br/><i>:3000</i>"]
    end

    subgraph "⚡ Ingestion Layer"
        API["📡 Analytics API<br/><i>:3001</i>"]
    end

    subgraph "💾 Storage Layer"
        PG[("🐘 PostgreSQL 16<br/><i>:5432</i>")]
    end

    subgraph "🧪 Intelligence Layer"
        ENG["🐍 Analytics Engine<br/><i>Python ML Pipeline</i>"]
        CB["🎰 Causal Bandit"]
        EVAL["📊 Evaluation Engine"]
    end

    subgraph "📈 Visualization Layer"
        DASH["📊 Analytics Dashboard<br/><i>:3002</i>"]
    end

    subgraph "🏪 Commerce Layer"
        MB["🔧 Medusa Backend<br/><i>:9000</i>"]
    end

    SF -->|"page_view, scroll_depth,<br/>hesitation, add_to_cart"| API
    SF -->|"GET /api/score"| API
    API -->|"INSERT events"| PG
    API -.->|"risk score + intervention"| SF
    ENG -->|"Read events → Compute → Write results"| PG
    CB -.->|"Select intervention arm"| ENG
    EVAL -.->|"IPW / CATE uplift"| ENG
    DASH -->|"GET /api/analytics/*"| API
    API -->|"SELECT"| PG
    SF <-->|"Products, Cart, Orders"| MB
    MB -->|"Commerce data"| PG

    style SF fill:#7c3aed,stroke:#5b21b6,color:#fff
    style API fill:#2563eb,stroke:#1d4ed8,color:#fff
    style PG fill:#4169e1,stroke:#2b4acb,color:#fff
    style ENG fill:#059669,stroke:#047857,color:#fff
    style CB fill:#d97706,stroke:#b45309,color:#fff
    style EVAL fill:#dc2626,stroke:#b91c1c,color:#fff
    style DASH fill:#7c3aed,stroke:#5b21b6,color:#fff
    style MB fill:#6b7280,stroke:#4b5563,color:#fff
```

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🔬 Contextual Decision Reconstruction
When a user doesn't convert, standard analytics sees **one event**. This system reconstructs the full situational context:

- 📦 How many products they'd already viewed
- 💰 Price anchoring relative to session history
- ⏱️ Time spent and scroll depth
- 🔍 Search vs. browse arrival intent
- 📉 Context-conditional conversion rates
- 🧪 Chi-squared significance testing

> *Same product viewed first → 31% conversion.*  
> *Viewed after 5 others → 8%. A 4× difference invisible to aggregate metrics.*

</td>
<td width="50%">

### ⛓️ Sequential Behavioral Modeling
Sessions are **Markov chains**, not event counts:

```mermaid
graph LR
    B["Browse"] -->|"0.62"| V["View"]
    V -->|"0.28"| C["Cart"]
    C -->|"0.45"| P["Purchase"]
    V -->|"0.15"| V
    V -->|"0.57"| B
    C -->|"0.55"| B

    style B fill:#3b82f6,stroke:#2563eb,color:#fff
    style V fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style C fill:#f59e0b,stroke:#d97706,color:#fff
    style P fill:#10b981,stroke:#059669,color:#fff
```

- Transition probability matrices
- Per-transition conversion lift
- Common path mining
- Anomaly detection on low-probability sessions

</td>
</tr>
<tr>
<td width="50%">

### 🎯 Real-time Causal Interventions
A **Contextual Bandit** model detects cognitive friction and triggers UI interventions in real-time:

- 🧠 Detects comparison fatigue, price shock, attention decay
- 💡 Selects optimal intervention (discount, urgency, recommendation)
- 📊 Measures causal uplift with IPW/CATE estimation
- 🔄 Continuously learns from outcomes

</td>
<td width="50%">

### 📊 In-Session Risk Scoring
After every state transition, the tracker calls `/api/score`:

```
User scrolls past fold → tracker detects hesitation
→ Markov scorer: P(abandon) = 0.73
→ Causal Bandit: show "10% off" nudge
→ InterventionProvider renders overlay
→ Outcome logged → bandit updates
```

Hook into it: `tracker.onRiskUpdate(callback)`

</td>
</tr>
</table>

---

## 📁 Repository Structure

```
📦 Realtime-Consumer-Behavior-and-Pattern-Analysis
│
├── 🧠 active_project/                    ★ THE ANALYTICS SYSTEM ★
│   ├── docker-compose.yml                 One-command orchestration
│   │
│   ├── 🛍️ storefront/                    Instrumented e-commerce frontend
│   │   ├── lib/tracking/tracker.ts        Behavioral event capture engine
│   │   ├── lib/analytics/processor.ts     Client-side analytics processor
│   │   ├── components/tracking/           Intervention UI components
│   │   └── app/                           Next.js pages + API routes
│   │
│   ├── 📡 analytics-api/                  Event ingestion + REST API
│   │   ├── app/api/events/                Raw event ingestion
│   │   ├── app/api/score/                 Real-time risk scoring
│   │   ├── app/api/analytics/             9 analytics endpoints
│   │   └── lib/db.ts                      PostgreSQL connection
│   │
│   ├── 🐍 analytics-engine/              Python ML pipeline
│   │   ├── processors/pipeline.py         8-stage processing orchestrator
│   │   ├── processors/sequence_modeler.py Markov chain modeling
│   │   ├── processors/context_analyzer.py Contextual decision reconstruction
│   │   ├── processors/causal_bandit.py    Contextual bandit for interventions
│   │   ├── processors/evaluation_engine.py IPW/CATE causal evaluation
│   │   └── sql/                           6 schema migration files
│   │
│   └── 📊 dashboard/                     Analytics command center
│       ├── app/                           9 dashboard views
│       └── components/charts/             Visualization components
│
├── 🔧 medusa-backend/                    MedusaJS v2 commerce engine
│   └── src/                               Custom modules, API routes, workflows
│
├── 🏪 medusa-backend-storefront/         Medusa storefront template
│   └── src/                               Pages, middleware, modules
│
├── 🛒 app/ + components/ + lib/          Legacy storefront (v1)
└── 📄 .gitignore, package.json, configs
```

---

## 🐍 Analytics Pipeline

The Python engine runs an **8-stage pipeline** that transforms raw events into actionable intelligence:

```mermaid
graph LR
    subgraph "Stage 1-3: Foundation"
        S1["1️⃣ Sessionize<br/>Raw Events"]
        S2["2️⃣ Product<br/>Analytics"]
        S3["3️⃣ User<br/>Features"]
    end

    subgraph "Stage 4-6: Aggregation"
        S4["4️⃣ Daily<br/>KPIs"]
        S5["5️⃣ Conversion<br/>Funnel"]
        S6["6️⃣ Prescriptive<br/>Rules"]
    end

    subgraph "Stage 7-8: Intelligence ★"
        S7["7️⃣ Markov<br/>Chains"]
        S8["8️⃣ Context<br/>Reconstruction"]
    end

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8

    style S1 fill:#3b82f6,stroke:#2563eb,color:#fff
    style S2 fill:#3b82f6,stroke:#2563eb,color:#fff
    style S3 fill:#3b82f6,stroke:#2563eb,color:#fff
    style S4 fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style S5 fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style S6 fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style S7 fill:#f59e0b,stroke:#d97706,color:#fff
    style S8 fill:#ef4444,stroke:#dc2626,color:#fff
```

| Stage | Processor | Input → Output |
|:---:|---|---|
| 1️⃣ | `refresh_sessions` | Raw events → Sessions (30-min inactivity window) |
| 2️⃣ | `refresh_product_analytics` | Sessions → Per-product: views, cart rate, avg time, scroll depth |
| 3️⃣ | `compute_user_features` | Sessions → RFM scores, churn risk, engagement tiers |
| 4️⃣ | `refresh_daily_kpis` | All data → Time-series KPI snapshots |
| 5️⃣ | `refresh_funnel` | Sessions → Funnel state counts (Browse→View→Cart→Purchase) |
| 6️⃣ | `generate_recommendations` | Analytics → Rule-based prescriptive recommendations |
| 7️⃣ | `run_sequence_pipeline` | Sessions → **Markov transition matrices, path mining, anomalies** |
| 8️⃣ | `run_context_pipeline` | Events → **Contextual decision reconstruction, contrastive insights** |

---

## 📊 Dashboard Views

<table>
<tr>
<td align="center" width="33%">
<b>📈 Overview</b><br/>
<sub>Real-time KPIs, session counts, conversion rates, revenue</sub>
</td>
<td align="center" width="33%">
<b>👥 Sessions</b><br/>
<sub>Session timeline, engagement breakdown, duration analysis</sub>
</td>
<td align="center" width="33%">
<b>📦 Products</b><br/>
<sub>Per-product performance, views vs. conversion, engagement heatmap</sub>
</td>
</tr>
<tr>
<td align="center" width="33%">
<b>🔻 Funnel</b><br/>
<sub>Visual conversion funnel with drop-off analysis</sub>
</td>
<td align="center" width="33%">
<b>🗺️ Paths</b><br/>
<sub>Markov chain visualization, common journeys, anomalies</sub>
</td>
<td align="center" width="33%">
<b>🔮 Predictions</b><br/>
<sub>ML churn predictions, engagement forecasting</sub>
</td>
</tr>
<tr>
<td align="center" width="33%">
<b>💡 Recommendations</b><br/>
<sub>Auto-generated prescriptive actions</sub>
</td>
<td align="center" width="33%">
<b>🧠 Context Analysis</b><br/>
<sub>Context-conditional conversion heatmaps, contrastive insights</sub>
</td>
<td align="center" width="33%">
<b>⚗️ Causal Evaluation</b><br/>
<sub>IPW/CATE results, intervention uplift measurement</sub>
</td>
</tr>
</table>

---

## 🚀 Quick Start

### Option 1: Docker (recommended)

```bash
cd active_project
docker compose up --build
```

| Service | URL |
|---|---|
| 🛍️ Storefront | [localhost:3000](http://localhost:3000) |
| 📡 Analytics API | [localhost:3001](http://localhost:3001) |
| 📊 Dashboard | [localhost:3002](http://localhost:3002) |
| 🐘 PostgreSQL | localhost:5432 |

### Option 2: Manual Setup

<details>
<summary><b>Click to expand manual setup instructions</b></summary>

#### 1. Database
```bash
psql -U postgres -c "CREATE DATABASE analytics_db;"
psql -U postgres -d analytics_db -f analytics-engine/sql/001_schema.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/002_seed.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/003_sequences.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/004_context.sql
psql -U postgres -d analytics_db -f analytics-engine/sql/005_context_seed.sql
```

#### 2. Analytics API (port 3001)
```bash
cd active_project/analytics-api
cp .env.example .env
npm install && npm run dev
```

#### 3. Python ML Pipeline
```bash
cd active_project/analytics-engine
python -m venv venv && source venv/bin/activate   # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python processors/pipeline.py --mode=full
```

#### 4. Dashboard (port 3002)
```bash
cd active_project/dashboard
cp .env.example .env
npm install && npm run dev
```

#### 5. Storefront (port 3000)
```bash
cd active_project/storefront
cp .env.example .env
npm install && npm run dev
```

</details>

### Medusa Commerce Backend

<details>
<summary><b>Click to expand Medusa setup instructions</b></summary>

The Medusa backend powers the actual e-commerce functionality (products, orders, carts):

```bash
cd medusa-backend
cp .env.example .env    # Configure DATABASE_URL, CORS, JWT secrets
npm install
npx medusa develop      # Starts on localhost:9000
```

The Medusa storefront:
```bash
cd medusa-backend-storefront
cp .env.local.example .env.local
npm install
npm run dev             # Starts on localhost:8000
```

</details>

---

## 🧪 API Reference

<details>
<summary><b>📡 Analytics API Endpoints</b></summary>

| Method | Endpoint | Description |
|:---:|---|---|
| `POST` | `/api/events` | Ingest raw behavioral events |
| `POST` | `/api/context-events` | Ingest enriched context events |
| `GET` | `/api/score` | Real-time session risk scoring |
| `GET` | `/api/analytics/summary` | Aggregated KPIs |
| `GET` | `/api/analytics/products` | Per-product performance |
| `GET` | `/api/analytics/funnel` | Conversion funnel data |
| `GET` | `/api/analytics/paths` | Markov chain paths |
| `GET` | `/api/analytics/predictions` | Churn/engagement predictions |
| `GET` | `/api/analytics/recommendations` | Prescriptive recommendations |
| `GET` | `/api/analytics/context` | Contextual decision analysis |
| `GET` | `/api/analytics/evaluation` | Causal evaluation (IPW/CATE) |
| `GET` | `/api/analytics/interventions` | Intervention decisions |

</details>

---

## 🗄️ Database Schema

```mermaid
erDiagram
    events {
        uuid id PK
        text session_id
        text event_type
        jsonb properties
        timestamp created_at
    }

    sessions {
        text session_id PK
        int event_count
        text[] states
        boolean converted
        timestamp started_at
    }

    decision_contexts {
        uuid id PK
        text session_id FK
        int products_viewed_before
        float price_relative_to_session
        float scroll_depth
        float time_on_page
        text arrival_intent
    }

    sequence_transitions {
        text from_state
        text to_state
        float probability
        float conversion_lift
    }

    context_conditional_rates {
        text product_id
        text context_bucket
        float conversion_rate
        float chi_squared_p_value
    }

    intervention_assignments {
        uuid id PK
        text session_id FK
        text arm_selected
        text trigger_reason
        float reward
    }

    events ||--o{ sessions : "belongs to"
    sessions ||--o{ decision_contexts : "has"
    sessions ||--o{ intervention_assignments : "receives"
    decision_contexts ||--o{ context_conditional_rates : "computes"
```

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology | Purpose |
|:---:|:---:|---|
| 🛍️ Storefront | Next.js 14, TypeScript | Instrumented e-commerce frontend |
| 📡 API | Next.js API Routes, `pg` | Event ingestion, analytics serving |
| 🐍 ML Engine | Python, NumPy, SciPy | Markov chains, causal ML, statistical tests |
| 💾 Database | PostgreSQL 16 | Event storage, computed analytics |
| 📊 Dashboard | Next.js 14, Tailwind CSS | Analytics visualization |
| 🏪 Commerce | MedusaJS v2 | Headless commerce (products, orders, carts) |
| 🐳 DevOps | Docker Compose | Multi-service orchestration |

</div>

---

## 🚢 Deployment

| Component | Platform | Tier |
|---|---|---|
| Storefront + Dashboard | Vercel | Free |
| Analytics API | Fly.io | Free |
| Python Engine | Fly.io | Free |
| PostgreSQL | Fly.io / Neon.tech | Free |

---

## 📄 License

This project is licensed under the [MIT License](license.md).

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:6e40c9&height=120&section=footer" width="100%"/>

<sub>Built with 💜 for research-grade behavioral analytics</sub>

</div>
]]>
