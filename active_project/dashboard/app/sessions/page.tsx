export const metadata = { title: 'Sessions' };
export const revalidate = 60;
const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/summary`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('');
    return res.json();
  } catch { return null; }
}

export default async function SessionsPage() {
  const data = await getData();
  const kpis = data?.kpis;

  const stats = kpis ? [
    { label: 'TOTAL SESSIONS', value: kpis.total_sessions?.toLocaleString(), color: '#4f8ef7' },
    { label: 'UNIQUE USERS', value: kpis.unique_users?.toLocaleString(), color: '#2dd4bf' },
    { label: 'AVG DURATION', value: `${Math.floor((kpis.avg_session_duration || 0) / 60)}m ${Math.round((kpis.avg_session_duration || 0) % 60)}s`, color: '#8b5cf6' },
    { label: 'BOUNCE RATE', value: `${kpis.bounce_rate || 0}%`, color: '#f59e0b' },
    { label: 'CONVERSION RATE', value: `${kpis.conversion_rate || 0}%`, color: '#22c55e' },
    { label: 'CART ABANDONMENT', value: `${kpis.cart_abandonment_rate || 0}%`, color: '#f43f5e' },
  ] : [];

  return (
    <div style={{ padding: '32px 32px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>Sessions</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Session-level behavioral metrics and aggregate activity patterns.</p>
      </div>

      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={s.label} className="card animate-in" style={{ padding: '24px 28px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 10, fontFamily: 'DM Mono' }}>{s.label}</div>
            <div className="font-display" style={{ fontSize: 36, fontWeight: 700, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card animate-in" style={{ padding: 28 }}>
        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>Session Metrics Explained</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { term: 'Session', def: 'A continuous sequence of interactions by a user. Sessions expire after 30 minutes of inactivity.' },
            { term: 'Bounce Rate', def: 'Percentage of sessions with only a single page view. High bounce may indicate poor landing page relevance.' },
            { term: 'Conversion Rate', def: 'Percentage of sessions that resulted in a completed purchase event.' },
            { term: 'Cart Abandonment', def: 'Proportion of sessions that added an item to cart but did not complete a purchase.' },
            { term: 'Avg Duration', def: 'Mean session length in seconds, calculated from first to last event timestamp per session.' },
            { term: 'Unique Users', def: 'Distinct user identifiers (or session IDs for anonymous users) seen in the period.' },
          ].map(({ term, def }) => (
            <div key={term} style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: '#4f8ef7', fontFamily: 'DM Mono', marginBottom: 6 }}>{term}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{def}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
