import FunnelClient from '../../components/charts/funnel-client';
export const metadata = { title: 'Funnel' };
export const revalidate = 60;
const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getFunnel() {
  try {
    const res = await fetch(`${API}/api/analytics/funnel`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch { return null; }
}

export default async function FunnelPage() {
  const data = await getFunnel();
  return (
    <div style={{ padding: '32px 32px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>
          Conversion Funnel
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          User journey from homepage through purchase. Drop-off points reveal friction areas.
        </p>
      </div>
      {data ? <FunnelClient data={data} /> : (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
          No funnel data available.
        </div>
      )}
    </div>
  );
}
