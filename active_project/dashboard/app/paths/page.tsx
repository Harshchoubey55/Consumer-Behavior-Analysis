import PathsClient from '../../components/charts/paths-client';
export const metadata = { title: 'Behavioral Paths' };
export const revalidate = 120;
const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/paths`, { next: { revalidate: 120 } });
    if (!res.ok) throw new Error('');
    return res.json();
  } catch { return null; }
}

export default async function PathsPage() {
  const data = await getData();
  return (
    <div style={{ padding: '32px 32px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Behavioral Paths
          </h1>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 10,
            fontFamily: 'DM Mono', letterSpacing: '0.1em',
            background: 'rgba(79,142,247,0.12)', color: '#4f8ef7',
            border: '1px solid rgba(79,142,247,0.25)',
          }}>
            MARKOV CHAIN MODEL
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 680 }}>
          Session sequences modeled as Markov chains — showing transition probabilities between behavioral states.
          Unlike funnel analysis (which requires pre-defining steps), this discovers the actual navigation topology from data.
          Each edge shows P(next state | current state) and the conversion lift of that transition.
        </p>
      </div>

      {data ? (
        <PathsClient data={data} />
      ) : (
        <div style={{
          padding: '48px 32px', textAlign: 'center',
          color: 'var(--text-muted)',
          border: '1px dashed var(--border)', borderRadius: 12,
          fontFamily: 'DM Mono',
        }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>∅</div>
          <div>No sequence data yet. Run the analytics pipeline first:</div>
          <code style={{ display: 'block', marginTop: 12, padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12 }}>
            python processors/pipeline.py --mode=full
          </code>
        </div>
      )}
    </div>
  );
}
