import { Suspense } from 'react';
import OverviewClient from '../components/charts/overview-client';

export const metadata = { title: 'Overview' };
export const revalidate = 60;

const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getSummary() {
  try {
    const res = await fetch(`${API}/api/analytics/summary`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch {
    return null;
  }
}

const EMPTY_SUMMARY = {
  kpis: {
    total_sessions: 0,
    unique_users: 0,
    total_events: 0,
    total_purchases: 0,
    avg_session_duration: 0,
    bounce_rate: 0,
    conversion_rate: 0,
    cart_abandonment_rate: 0,
  },
  trend: [
    { date: 'Mon', sessions: '0', users: '0', events: '0', conversions: '0' },
    { date: 'Tue', sessions: '0', users: '0', events: '0', conversions: '0' },
    { date: 'Wed', sessions: '0', users: '0', events: '0', conversions: '0' },
    { date: 'Thu', sessions: '0', users: '0', events: '0', conversions: '0' },
    { date: 'Fri', sessions: '0', users: '0', events: '0', conversions: '0' },
    { date: 'Sat', sessions: '0', users: '0', events: '0', conversions: '0' },
    { date: 'Sun', sessions: '0', users: '0', events: '0', conversions: '0' }
  ],
  devices: [
    { device_type: 'Desktop', count: '0' },
    { device_type: 'Mobile', count: '0' },
    { device_type: 'Tablet', count: '0' }
  ],
  engagement: [
    { tier: 'high', count: '0' },
    { tier: 'medium', count: '0' },
    { tier: 'low', count: '0' }
  ],
  churn: [
    { risk: 'low', count: '0', avg_prob: '0' },
    { risk: 'medium', count: '0', avg_prob: '0' },
    { risk: 'high', count: '0', avg_prob: '0' }
  ],
};

export default async function OverviewPage() {
  const data = await getSummary() || EMPTY_SUMMARY;

  return (
    <div style={{ padding: '32px 32px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Overview Dashboard
            </h1>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>
              LIVE REALTIME
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aggregate behavioral metrics across all user sessions and causal interventions.
          </p>
        </div>
        
        {data === EMPTY_SUMMARY && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, background: '#ef4444', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
            Awaiting Data Feed (Zero State)
          </div>
        )}
      </div>

      <OverviewClient data={data} />
    </div>
  );
}
