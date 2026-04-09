'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
type OverviewData = {
  kpis: {
    totalEvents: number; totalSessions: number; totalUsers: number;
    totalRevenue: number; conversionRate: number; bounceRate: number;
    eventsLast24h: number; avgOrderValue: number;
  };
  timeSeries: { date: string; sessions: number; conversions: number }[];
  segments: { name: string; count: number }[];
};

type FunnelData = {
  funnel: { name: string; value: number; stage: string; dropOff: number; conversionFromTop: number }[];
  snapshots: any[];
  checkoutSteps: { step: number; label: string; users: number }[];
};

type ProductData = {
  all: any[]; byRevenue: any[]; byConversion: any[]; lowConversion: any[];
};

type ChurnData = {
  summary: any; riskBuckets: any[]; engagementBuckets: any[];
  scatterData: any[]; atRisk: any[]; featureImportance: any[];
};

type InsightData = {
  insights: {
    id: string; type: string; severity: string; title: string;
    description: string; action: string; metric: string;
    value: number; threshold: number; entityName?: string;
  }[];
};

type SessionData = {
  averages: { duration: number; pageViews: number; productViews: number };
  hourlyDistribution: { hour: number; label: string; sessions: number; conversions: number; rate: number }[];
  durationDistribution: { label: string; count: number }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const PALETTE = {
  primary: '#0f172a',
  accent: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  muted: '#94a3b8',
  chart: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'],
};

function fmt(n: number, type: 'currency' | 'percent' | 'number' | 'duration' = 'number'): string {
  if (type === 'currency') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (type === 'percent') return `${n.toFixed(1)}%`;
  if (type === 'duration') {
    const m = Math.floor(n / 60);
    const s = Math.floor(n % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  return n.toLocaleString();
}

const SEV_COLORS = { critical: '#ef4444', warning: '#f59e0b', info: '#6366f1' };
const SEV_BG = { critical: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200', info: 'bg-indigo-50 border-indigo-100' };

function KPICard({ label, value, sub, color = '#6366f1' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight" style={{ color }}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-slate-400">{desc}</p>}
    </div>
  );
}

const TABS = ['Overview', 'Funnel', 'Products', 'Sessions', 'Predictions', 'Insights'];

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [tab, setTab] = useState('Overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [products, setProducts] = useState<ProductData | null>(null);
  const [churn, setChurn] = useState<ChurnData | null>(null);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [sessions, setSessions] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, fn, pr, ch, ins, se] = await Promise.all([
        fetch('/api/analytics/overview').then((r) => r.json()),
        fetch('/api/analytics/funnel').then((r) => r.json()),
        fetch('/api/analytics/products').then((r) => r.json()),
        fetch('/api/analytics/churn').then((r) => r.json()),
        fetch('/api/analytics/prescriptive').then((r) => r.json()),
        fetch('/api/analytics/sessions').then((r) => r.json()),
      ]);
      setOverview(ov); setFunnel(fn); setProducts(pr);
      setChurn(ch); setInsights(ins); setSessions(se);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const reprocess = async () => {
    setReprocessing(true);
    await fetch('/api/analytics/prescriptive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reprocess' }),
    });
    await fetchAll();
    setReprocessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Consumer Behavior Analytics</h1>
              <p className="text-xs text-slate-400">Internal Analytics Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="text-xs text-slate-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
            <button
              onClick={reprocess}
              disabled={reprocessing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${reprocessing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {reprocessing ? 'Processing...' : 'Re-run Pipeline'}
            </button>
            <a href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              View Store →
            </a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white px-6">
        <div className="mx-auto max-w-screen-xl">
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                  tab === t ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                )}
                {t === 'Insights' && insights && insights.insights.filter(i => i.severity === 'critical').length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {insights.insights.filter(i => i.severity === 'critical').length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-screen-xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-slate-400">Loading analytics data...</p>
            </div>
          </div>
        ) : (
          <>
            {tab === 'Overview' && overview && <OverviewTab data={overview} />}
            {tab === 'Funnel' && funnel && <FunnelTab data={funnel} />}
            {tab === 'Products' && products && <ProductsTab data={products} />}
            {tab === 'Sessions' && sessions && <SessionsTab data={sessions} />}
            {tab === 'Predictions' && churn && <PredictionsTab data={churn} />}
            {tab === 'Insights' && insights && <InsightsTab data={insights} onReprocess={reprocess} />}
          </>
        )}
      </main>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: OverviewData }) {
  const SEGMENT_COLORS = { high_value: '#10b981', at_risk: '#ef4444', new: '#6366f1', casual: '#94a3b8' };

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Total Sessions" value={fmt(data.kpis.totalSessions)} sub={`${fmt(data.kpis.eventsLast24h)} events today`} />
        <KPICard label="Unique Users" value={fmt(data.kpis.totalUsers)} color="#6366f1" />
        <KPICard label="Total Revenue" value={fmt(data.kpis.totalRevenue, 'currency')} sub={`Avg order: ${fmt(data.kpis.avgOrderValue, 'currency')}`} color="#10b981" />
        <KPICard label="Conversion Rate" value={fmt(data.kpis.conversionRate, 'percent')} sub={`Bounce rate: ${fmt(data.kpis.bounceRate, 'percent')}`} color={data.kpis.conversionRate >= 3 ? '#10b981' : '#f59e0b'} />
      </div>

      {/* Time Series */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader title="Sessions & Conversions (30 days)" desc="Daily session volume with conversion overlay" />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data.timeSeries} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="conversions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              formatter={(v: number, name: string) => [v, name === 'sessions' ? 'Sessions' : 'Conversions']}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="sessions" stroke="#6366f1" fill="url(#sessions)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="conversions" stroke="#10b981" fill="url(#conversions)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Segments */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="User Segments" desc="Behavioral segmentation of all users" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.segments} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data.segments.map((seg, i) => (
                  <Cell key={i} fill={SEGMENT_COLORS[seg.name as keyof typeof SEGMENT_COLORS] || PALETTE.chart[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Key Metrics Summary" />
          <div className="space-y-3">
            {[
              { label: 'Total Events Captured', value: fmt(data.kpis.totalEvents), icon: '📡' },
              { label: 'Sessions (30 days)', value: fmt(data.kpis.totalSessions), icon: '👤' },
              { label: 'Bounce Rate', value: fmt(data.kpis.bounceRate, 'percent'), icon: '↩️' },
              { label: 'Avg Order Value', value: fmt(data.kpis.avgOrderValue, 'currency'), icon: '💰' },
              { label: 'Conversion Rate', value: fmt(data.kpis.conversionRate, 'percent'), icon: '🎯' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{item.icon}</span> {item.label}
                </span>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Funnel Tab ────────────────────────────────────────────────────────────────
function FunnelTab({ data }: { data: FunnelData }) {
  const maxVal = data.funnel[0]?.value || 1;

  return (
    <div className="space-y-8">
      {/* Visual Funnel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader title="Conversion Funnel" desc="User progression through key interaction stages" />
        <div className="mt-4 space-y-3">
          {data.funnel.map((step, i) => {
            const width = (step.value / maxVal) * 100;
            const colors = ['bg-indigo-600', 'bg-indigo-500', 'bg-violet-500', 'bg-violet-400', 'bg-emerald-500'];
            return (
              <div key={step.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{step.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500">{fmt(step.conversionFromTop, 'percent')} of total</span>
                    <span className="font-bold text-slate-900">{fmt(step.value)}</span>
                  </div>
                </div>
                <div className="flex h-10 items-center overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className={`flex h-full items-center justify-end pr-3 transition-all ${colors[i]}`}
                    style={{ width: `${Math.max(width, 4)}%` }}
                  >
                    {width > 15 && (
                      <span className="text-xs font-semibold text-white">{fmt(step.value)}</span>
                    )}
                  </div>
                </div>
                {i < data.funnel.length - 1 && step.dropOff > 0 && (
                  <p className="mt-1 text-right text-xs text-red-500">
                    ↓ {fmt(step.dropOff, 'percent')} drop-off
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Funnel trend + checkout steps */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Daily Funnel Trend" desc="30-day funnel performance" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.snapshots} margin={{ left: -20, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="visitors" stroke="#6366f1" dot={false} strokeWidth={2} name="Visitors" />
              <Line type="monotone" dataKey="productViewers" stroke="#8b5cf6" dot={false} strokeWidth={2} name="Product Views" />
              <Line type="monotone" dataKey="cartAdders" stroke="#f59e0b" dot={false} strokeWidth={2} name="Cart Adds" />
              <Line type="monotone" dataKey="purchasers" stroke="#10b981" dot={false} strokeWidth={2} name="Purchases" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Checkout Step Drop-off" desc="Users completing each checkout step" />
          {data.checkoutSteps.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.checkoutSteps} margin={{ left: -20, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="users" fill="#6366f1" radius={[6, 6, 0, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-48 items-center justify-center text-slate-400 text-sm">
              No checkout step data yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────────
function ProductsTab({ data }: { data: ProductData }) {
  return (
    <div className="space-y-8">
      {/* Top by revenue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader title="Product Performance" desc="Views, cart adds, and conversion rates" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">Product</th>
                <th className="pb-3 pr-4 text-right">Views</th>
                <th className="pb-3 pr-4 text-right">Cart Adds</th>
                <th className="pb-3 pr-4 text-right">Purchases</th>
                <th className="pb-3 pr-4 text-right">View→Cart</th>
                <th className="pb-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.all.map((p) => (
                <tr key={p.productId} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium text-slate-800">{p.productName}</td>
                  <td className="py-3 pr-4 text-right text-slate-600">{fmt(p.views)}</td>
                  <td className="py-3 pr-4 text-right text-slate-600">{fmt(p.cartAdds)}</td>
                  <td className="py-3 pr-4 text-right text-slate-600">{fmt(p.purchases)}</td>
                  <td className="py-3 pr-4 text-right">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.viewToCart >= 0.15 ? 'bg-green-100 text-green-700' :
                      p.viewToCart >= 0.05 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {fmt(p.viewToCart * 100, 'percent')}
                    </span>
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-800">{fmt(p.revenue, 'currency')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View→Cart chart */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="View → Cart Conversion" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.all} layout="vertical" margin={{ left: 10, right: 40 }}>
              <XAxis type="number" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="productName" tick={{ fontSize: 10 }} width={140} tickFormatter={(v) => v.length > 20 ? v.slice(0, 20) + '…' : v} />
              <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'View→Cart']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="viewToCart" radius={[0, 4, 4, 0]} name="View→Cart">
                {data.all.map((p, i) => (
                  <Cell key={i} fill={p.viewToCart >= 0.15 ? '#10b981' : p.viewToCart >= 0.05 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Revenue by Product" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byRevenue.slice(0, 8)} margin={{ left: -10, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="productName" tick={{ fontSize: 9 }} tickFormatter={(v) => v.split(' ').slice(0, 2).join(' ')} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(0)}`, 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────
function SessionsTab({ data }: { data: SessionData }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Avg Session Duration" value={fmt(data.averages.duration, 'duration')} />
        <KPICard label="Avg Page Views" value={data.averages.pageViews.toFixed(1)} color="#6366f1" />
        <KPICard label="Avg Product Views" value={data.averages.productViews.toFixed(1)} color="#10b981" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Sessions by Hour of Day" desc="When users are most active and converting" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.hourlyDistribution} margin={{ left: -20, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={3} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sessions" fill="#6366f1" radius={[3, 3, 0, 0]} name="Sessions" />
              <Bar dataKey="conversions" fill="#10b981" radius={[3, 3, 0, 0]} name="Conversions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Session Duration Distribution" desc="Breakdown of how long users stay" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.durationDistribution} margin={{ left: -20, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Predictions Tab ───────────────────────────────────────────────────────────
function PredictionsTab({ data }: { data: ChurnData }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard label="Avg Churn Risk" value={`${data.summary.avgChurnRisk}%`} color="#ef4444" sub="Across all users" />
        <KPICard label="Avg Engagement" value={`${data.summary.avgEngagementScore}`} color="#6366f1" sub="Out of 100" />
        <KPICard label="Predicted to Churn (7d)" value={fmt(data.summary.willChurn7d)} color="#f59e0b" />
        <KPICard label="Predicted Engaged (7d)" value={fmt(data.summary.willEngage7d)} color="#10b981" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Churn risk distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Churn Risk Distribution" desc="User population by predicted churn probability" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.riskBuckets} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, value }) => `${name}: ${value}`}>
                {data.riskBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Feature importance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Churn Model — Feature Importance" desc="Behavioral signals driving churn predictions" />
          <div className="mt-2 space-y-3">
            {data.featureImportance.map((f) => (
              <div key={f.feature}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-600">{f.feature}</span>
                  <span className="font-semibold text-slate-800">{(f.importance * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${f.importance * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scatter: engagement vs churn */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SectionHeader title="Engagement vs Churn Risk" desc="Each point represents a user. High engagement + low churn = ideal." />
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ left: -10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="engagementScore" name="Engagement Score" type="number" tick={{ fontSize: 11 }} label={{ value: 'Engagement Score', position: 'insideBottom', offset: -4, fontSize: 11 }} />
            <YAxis dataKey="churnRisk" name="Churn Risk %" type="number" tick={{ fontSize: 11 }} label={{ value: 'Churn Risk %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number, name: string) => [name === 'churnRisk' ? `${v}%` : v, name === 'churnRisk' ? 'Churn Risk' : 'Engagement']} />
            <Scatter data={data.scatterData.slice(0, 200)} fill="#6366f1" fillOpacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* High-value at-risk users */}
      {data.atRisk.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="High-Value At-Risk Users" desc="Users with purchase history and high churn probability — prioritize retention" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-2 pr-4 text-left">User ID</th>
                  <th className="pb-2 pr-4 text-right">Churn Risk</th>
                  <th className="pb-2 pr-4 text-right">Engagement</th>
                  <th className="pb-2 pr-4 text-right">Revenue</th>
                  <th className="pb-2 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.slice(0, 10).map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{u.id}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {(u.churnRisk * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">{u.engagementScore.toFixed(0)}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-slate-800">{fmt(u.totalRevenue, 'currency')}</td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {u.daysSinceLastSeen != null ? `${u.daysSinceLastSeen}d ago` : 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Insights Tab ──────────────────────────────────────────────────────────────
function InsightsTab({ data, onReprocess }: { data: InsightData; onReprocess: () => void }) {
  const TYPE_ICONS: Record<string, string> = {
    product_issue: '📦', funnel_leak: '🕳️', churn_alert: '⚠️',
    opportunity: '💡', engagement_drop: '📉',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Prescriptive Insights</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Rule-based recommendations generated from behavioral analytics
          </p>
        </div>
        <button onClick={onReprocess} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Regenerate Insights
        </button>
      </div>

      {data.insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-center">
          <p className="text-slate-400">No active insights. Click "Re-run Pipeline" to generate them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.insights.map((insight) => (
            <div
              key={insight.id}
              className={`rounded-2xl border p-5 ${SEV_BG[insight.severity as keyof typeof SEV_BG] || 'bg-white border-slate-200'}`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5 text-2xl">{TYPE_ICONS[insight.type] || '📊'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: SEV_COLORS[insight.severity as keyof typeof SEV_COLORS] || '#94a3b8' }}>
                      {insight.severity}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{insight.type.replace(/_/g, ' ')}</span>
                    {insight.entityName && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{insight.entityName}</span>
                    )}
                  </div>
                  <h3 className="mt-2 font-semibold text-slate-800">{insight.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{insight.description}</p>

                  {insight.metric && insight.value != null && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="rounded-lg bg-white/60 px-3 py-1.5 text-xs">
                        <span className="text-slate-400">Metric: </span>
                        <span className="font-semibold text-slate-700">{(insight.value * 100 < 10 && insight.value <= 1) ? `${(insight.value * 100).toFixed(1)}%` : insight.value.toFixed(1)}</span>
                      </div>
                      {insight.threshold != null && (
                        <div className="rounded-lg bg-white/60 px-3 py-1.5 text-xs">
                          <span className="text-slate-400">Benchmark: </span>
                          <span className="font-semibold text-slate-700">{(insight.threshold * 100 < 10 && insight.threshold <= 1) ? `${(insight.threshold * 100).toFixed(1)}%` : insight.threshold.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {insight.action && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 p-3 text-sm">
                      <span className="mt-0.5 shrink-0 text-green-600">→</span>
                      <span className="text-slate-700">{insight.action}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
