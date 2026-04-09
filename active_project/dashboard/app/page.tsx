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

export default async function OverviewPage() {
  const data = await getSummary();

  return (
    <div style={{ padding: '32px 32px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Overview
          </h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
            LAST 30 DAYS
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Aggregate behavioral metrics across all user sessions and interactions.
        </p>
      </div>

      {data ? (
        <OverviewClient data={data} />
      ) : (
        <div style={{
          padding: '48px 32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          border: '1px dashed var(--border)',
          borderRadius: 12,
          fontFamily: 'DM Mono',
        }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⚠</div>
          <div>No data available. Ensure the analytics API is running and the database has been seeded.</div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            API: {API}/api/analytics/summary
          </div>
        </div>
      )}
    </div>
  );
}
