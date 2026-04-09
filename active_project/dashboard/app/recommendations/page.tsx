import RecommendationsClient from '../../components/charts/recommendations-client';
export const metadata = { title: 'Insights' };
export const revalidate = 60;
const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/recommendations`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('');
    return res.json();
  } catch { return null; }
}

export default async function RecommendationsPage() {
  const data = await getData();
  return (
    <div style={{ padding: '32px 32px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>Prescriptive Insights</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Rule-based recommendations derived from analytics and prediction outputs. Actionable signals for product and growth teams.
        </p>
      </div>
      {data ? <RecommendationsClient data={data} /> : <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>No insights available. Run the analytics pipeline first.</div>}
    </div>
  );
}
