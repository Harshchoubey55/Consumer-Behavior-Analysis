'use client';

import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

type SummaryData = {
  kpis: {
    total_sessions: number;
    unique_users: number;
    total_events: number;
    total_purchases: number;
    avg_session_duration: number;
    bounce_rate: number;
    conversion_rate: number;
    cart_abandonment_rate: number;
  };
  trend: { date: string; sessions: string; users: string; events: string; conversions: string }[];
  devices: { device_type: string; count: string }[];
  engagement: { tier: string; count: string }[];
  churn: { risk: string; count: string; avg_prob: string }[];
};

const COLORS = {
  blue:   '#4f8ef7',
  teal:   '#2dd4bf',
  amber:  '#f59e0b',
  rose:   '#f43f5e',
  violet: '#8b5cf6',
  green:  '#22c55e',
  muted:  '#4d566f',
};

function KPICard({ label, value, sub, color, format }: {
  label: string;
  value: number;
  sub?: string;
  color?: string;
  format?: 'number' | 'percent' | 'duration' | 'seconds';
}) {
  let displayValue = '';
  if (format === 'percent') displayValue = value.toFixed(1) + '%';
  else if (format === 'seconds') {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    displayValue = m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  else displayValue = value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toString();

  return (
    <div className="card animate-in" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 10, fontFamily: 'DM Mono' }}>
        {label}
      </div>
      <div className="font-display" style={{
        fontSize: 34,
        fontWeight: 700,
        color: color || 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        {displayValue}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'DM Mono',
  color: 'var(--text-primary)',
};

export default function OverviewClient({ data }: { data: SummaryData }) {
  const { kpis, trend, devices, engagement, churn } = data;

  const trendData = trend.map(d => ({
    date: d.date,
    sessions: parseInt(d.sessions),
    users: parseInt(d.users),
    conversions: parseInt(d.conversions || '0'),
  }));

  const deviceData = devices.map((d, i) => ({
    name: d.device_type,
    value: parseInt(d.count),
    color: [COLORS.blue, COLORS.teal, COLORS.violet][i] || COLORS.muted,
  }));

  const engagementData = engagement.map(e => ({
    tier: e.tier,
    count: parseInt(e.count),
    color: e.tier === 'high' ? COLORS.green : e.tier === 'medium' ? COLORS.amber : COLORS.muted,
  }));

  const churnData = churn.map(c => ({
    risk: c.risk,
    count: parseInt(c.count),
    avg_prob: parseFloat(c.avg_prob),
    color: c.risk === 'high' ? COLORS.rose : c.risk === 'medium' ? COLORS.amber : COLORS.green,
  }));

  return (
    <div>
      {/* KPI Grid */}
      <div className="stagger" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <KPICard label="TOTAL SESSIONS" value={kpis.total_sessions} color={COLORS.blue} sub="Last 30 days" />
        <KPICard label="UNIQUE USERS" value={kpis.unique_users} color={COLORS.teal} />
        <KPICard label="TOTAL EVENTS" value={kpis.total_events} color={COLORS.violet} />
        <KPICard label="PURCHASES" value={kpis.total_purchases} color={COLORS.green} />
        <KPICard label="AVG SESSION" value={kpis.avg_session_duration} format="seconds" sub="Duration" />
        <KPICard label="BOUNCE RATE" value={kpis.bounce_rate} format="percent" color={kpis.bounce_rate > 50 ? COLORS.amber : COLORS.teal} />
        <KPICard label="CONVERSION" value={kpis.conversion_rate} format="percent" color={COLORS.green} />
        <KPICard label="CART ABANDON" value={kpis.cart_abandonment_rate} format="percent" color={kpis.cart_abandonment_rate > 70 ? COLORS.rose : COLORS.amber} />
      </div>

      {/* Session Trend */}
      <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            Session & User Trend
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Daily sessions vs. unique users (last 14 days)</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.blue}   stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.blue}   stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.teal}   stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLORS.teal}   stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--text-muted)' }} />
            <Area type="monotone" dataKey="sessions" stroke={COLORS.blue} strokeWidth={2} fill="url(#gradSessions)" dot={false} />
            <Area type="monotone" dataKey="users" stroke={COLORS.teal} strokeWidth={2} fill="url(#gradUsers)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: 3 charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

        {/* Device breakdown */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Device Split</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={deviceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                dataKey="value" paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {deviceData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement tiers */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Engagement Tiers</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            {engagementData.map(e => {
              const total = engagementData.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? (e.count / total) * 100 : 0;
              return (
                <div key={e.tier}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{e.tier}</span>
                    <span style={{ color: e.color, fontFamily: 'DM Mono' }}>{e.count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <div className="bar-fill" style={{ height: '100%', width: `${pct}%`, background: e.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Churn risk */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Churn Risk</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            {churnData.map(c => {
              const total = churnData.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? (c.count / total) * 100 : 0;
              return (
                <div key={c.risk}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{c.risk} risk</span>
                    <span style={{ color: c.color, fontFamily: 'DM Mono' }}>{c.count} · avg {c.avg_prob}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <div className="bar-fill" style={{ height: '100%', width: `${pct}%`, background: c.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
