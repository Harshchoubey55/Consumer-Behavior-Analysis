# Consumer Behavior & Pattern Analysis System

A full end-to-end internal product analytics system built on top of a production-grade e-commerce storefront.
Every user interaction is captured, processed into behavioral features, analyzed descriptively and predictively,
and surfaced through an internal analytics dashboard.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     E-Commerce Storefront                    │
│            (Next.js 14 · App Router · Tailwind)             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Event Tracking SDK (client)              │  │
│  │  page_view · product_view · add_to_cart · search     │  │
│  │  checkout_start · checkout_step · purchase            │  │
│  └──────────────────┬───────────────────────────────────┘  │
└─────────────────────┼───────────────────────────────────────┘
                      │ POST /api/events (batched)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Ingestion Layer (API Route)                  │
│         Validates · Enriches · Persists to DB               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQLite / PostgreSQL DB                      │
│   events · sessions · user_profiles · product_analytics      │
│   funnel_snapshots · insights                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐   ┌──────────────────────────────────┐
│ Processing Layer │   │          Analytics APIs           │
│ sessionization   │   │ /api/analytics/overview           │
│ feature eng.     │   │ /api/analytics/funnel             │
│ metric derivation│   │ /api/analytics/products           │
│ churn scoring    │   │ /api/analytics/sessions           │
└──────────────────┘   │ /api/analytics/churn              │
                       │ /api/analytics/prescriptive       │
                       └──────────────┬───────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────────┐
                       │      Analytics Dashboard          │
                       │  /dashboard                       │
                       │                                   │
                       │  ● Overview KPIs + Time Series    │
                       │  ● Conversion Funnel Analysis     │
                       │  ● Product Performance Table      │
                       │  ● Session Behavior Patterns      │
                       │  ● Churn & Engagement Predictions │
                       │  ● Prescriptive Insights          │
                       └──────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Charts | Recharts |
| Validation | Zod |
| Fonts | Geist |

**No external analytics services.** No Mixpanel. No Segment. No Google Analytics. Entirely self-contained.

---

## Features

### 1. Event Tracking SDK (`lib/analytics/tracker.ts`)
Client-side SDK that:
- Assigns persistent user IDs (localStorage)
- Creates sessions with 30-minute timeout (rolling)
- Batches events and sends them to `/api/events` with a 1s debounce
- Uses `keepalive: true` to flush events on page unload
- Tracks: `page_view`, `product_view`, `add_to_cart`, `remove_from_cart`, `search`, `category_click`, `checkout_start`, `checkout_step`, `purchase`

### 2. Ingestion API (`/api/events`)
- Validates every event with Zod schema
- Accepts batches up to 50 events
- Persists as immutable records with timestamps
- Returns count of received events

### 3. Processing Pipeline (`lib/analytics/processor.ts`)
Run on-demand via the dashboard "Re-run Pipeline" button or automatically:
- **Sessionization**: Groups raw events into session records with derived metrics
- **User Profiling**: Aggregates session-level data into user behavioral profiles
- **Product Analytics**: Computes view→cart and cart→purchase conversion rates
- **Churn Scoring**: Heuristic model combining recency, frequency, purchase history
- **Engagement Scoring**: Weighted behavioral signal sum (0–100 scale)

### 4. Predictive Analytics
Built into the processing layer:
- **Churn Risk (0–1)**: `min(1, days_since_last_visit / 14 × (1 - purchase_rate × 3))`
- **Engagement Score (0–100)**: `productViews×2 + cartAdds×5 + purchases×20 + sessions×3`
- **7-day Cohort Forecasting**: Based on current risk distribution
- **User Segmentation**: `high_value` / `at_risk` / `new` / `casual`

### 5. Prescriptive Insights
Rule-based reasoning layer that generates actionable recommendations:
- Products with view→cart rate below 5% benchmark
- Products with cart abandonment above 70%
- Checkout step drop-off exceeding 40%
- High-risk user populations exceeding thresholds
- Bounce rate and overall conversion anomalies

### 6. Analytics Dashboard (`/dashboard`)
Six sections:
- **Overview**: KPI cards, 30-day session/conversion time series, user segments pie chart
- **Funnel**: Visual conversion funnel with drop-off rates, daily trend lines, checkout step analysis
- **Products**: Performance table with color-coded conversion rates, view→cart bar chart, revenue chart
- **Sessions**: Duration averages, hourly activity heatmap, session duration distribution
- **Predictions**: Churn risk distribution, engagement score buckets, risk vs engagement scatter, at-risk user list with feature importance
- **Insights**: Prescriptive recommendations with severity badges, metric vs benchmark display, and actionable next steps

---

## Local Setup

### Prerequisites
- Node.js 18+
- npm or pnpm

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The default `.env` uses SQLite — **no database installation required** for local dev:

```env
DATABASE_URL="file:./dev.db"
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Create tables
npm run db:push

# Seed with 800 sessions of realistic demo data
npm run db:seed
```

### 4. Run the app

```bash
npm run dev
```

- **Storefront**: http://localhost:3000
- **Analytics Dashboard**: http://localhost:3000/dashboard
- **Event API**: http://localhost:3000/api/events

### Optional: Prisma Studio (visual DB browser)

```bash
npm run db:studio
```

---

## How the Data Flow Works

1. You visit http://localhost:3000 → a `page_view` event fires
2. You click a product → `product_view` fires
3. You click "Add to Cart" → `add_to_cart` fires
4. All events are batched and sent to `POST /api/events` after 1 second
5. Events are stored in the `Event` table as raw records
6. Click "Re-run Pipeline" in the dashboard → the processing pipeline runs:
   - Sessions are built from raw events
   - User profiles are updated
   - Product analytics are recalculated
   - Prescriptive insights are regenerated
7. The dashboard charts update immediately

---

## Deployment (Free Options)

### Option A: Vercel + Neon (PostgreSQL) — Recommended

**Neon** (https://neon.tech) is a free serverless PostgreSQL service.

1. Create a free account on neon.tech
2. Create a new project → copy the connection string
3. Update `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require"
   ```
4. Update `prisma/schema.prisma` provider:
   ```
   provider = "postgresql"
   ```
5. Push schema: `npm run db:push`
6. Seed: `npm run db:seed`
7. Push to GitHub and deploy on Vercel — set `DATABASE_URL` in Vercel env vars

### Option B: Fly.io (full-stack on one platform)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh
fly auth signup

# From project root
fly launch          # follow prompts
fly postgres create # creates free attached Postgres

fly secrets set DATABASE_URL="postgres://..."
fly deploy
```

### Option C: Oracle Always Free VPS (self-hosted)

1. Get a free Oracle Cloud ARM VM (see setup guide below)
2. Install Node 18 + SQLite or PostgreSQL
3. Clone your repo, `npm install`, `npm run db:push`, `npm run db:seed`
4. Run with PM2: `pm2 start "npm run start" --name analytics`
5. Configure nginx as a reverse proxy on port 3000
6. Add free SSL with `certbot --nginx`

Full VPS guide: see the companion setup documentation.

---

## Project Structure

```
storefront/
├── app/
│   ├── api/
│   │   ├── events/route.ts           # Event ingestion endpoint
│   │   └── analytics/
│   │       ├── overview/route.ts     # KPIs + time series
│   │       ├── funnel/route.ts       # Funnel analysis
│   │       ├── products/route.ts     # Product performance
│   │       ├── sessions/route.ts     # Session patterns
│   │       ├── churn/route.ts        # Predictive analytics
│   │       └── prescriptive/route.ts # Insights + pipeline trigger
│   ├── dashboard/page.tsx            # Internal analytics dashboard
│   ├── product/[handle]/page.tsx     # Product detail (tracked)
│   ├── search/page.tsx               # Search (tracked)
│   ├── layout.tsx                    # Root layout + PageTracker
│   └── page.tsx                      # Homepage
├── components/
│   ├── tracking/page-tracker.tsx     # Auto page view tracker
│   └── layout/navbar/index.tsx       # Navigation
├── lib/
│   ├── analytics/
│   │   ├── tracker.ts                # Client-side tracking SDK
│   │   └── processor.ts              # Processing pipeline
│   └── db.ts                         # Prisma singleton
├── prisma/
│   ├── schema.prisma                 # DB schema (6 models)
│   └── seed.ts                       # Demo data generator
├── .env.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## License

MIT
