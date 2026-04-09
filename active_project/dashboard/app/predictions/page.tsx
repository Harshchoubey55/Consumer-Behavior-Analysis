import PredictionsClient from '../../components/charts/predictions-client';
export const metadata = { title: 'Predictions' };
export const revalidate = 60;
const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/predictions`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('');
    return res.json();
  } catch { return null; }
}

export default async function PredictionsPage() {
  const data = await getData();
  return (
    <div style={{ padding: '32px 32px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>Predictions</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Churn probability estimates, engagement scoring, and RFM user segmentation using behavioral features.</p>
      </div>
      {data ? <PredictionsClient data={data} /> : <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>No prediction data available.</div>}
    </div>
  );
}
