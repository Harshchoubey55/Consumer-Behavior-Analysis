export const metadata = { title: 'Session Anomalies' };
export const revalidate = 120;

const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/anomalies`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

const TYPE_META: Record<string, { label: string; color: string; desc: string }> = {
  improbable_path: {
    label: 'Improbable Path',
    color: 'var(--accent-rose)',
    desc: 'State sequence is statistically unlikely given the Markov model',
  },
  loop_heavy: {
    label: 'Loop Heavy',
    color: 'var(--accent-amber)',
    desc: 'Session revisits states repeatedly — possible confusion or UX issue',
  },
  ultra_short: {
    label: 'Ultra Short',
    color: 'var(--accent-blue)',
    desc: 'Session with very few transitions — possible bot or immediate bounce',
  },
};

export default async function AnomaliesPage() {
  const data = await getData();
  const anomalies   = data?.anomalies     || [];
  const summary     = data?.summary       || null;
  const breakdown   = data?.typeBreakdown || [];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Session Anomalies
          </h1>
          <span style={{ fontSize: 12, color: 'var(--accent-rose)', fontFamily: 'DM Mono', background: 'rgba(244,63,94,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(244,63,94,0.2)' }}>
            MARKOV z &lt; -2σ
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 640 }}>
          Sessions whose behavioral path log-probability is ≥2 standard deviations below the population mean.
          May indicate confused users, UX friction points, or bot traffic worth investigating.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { v: summary.total_flagged, l: 'FLAGGED SESSIONS', c: 'var(--accent-rose)' },
            { v: summary.converted_count, l: 'CONVERTED DESPITE', c: 'var(--accent-green)' },
            { v: `${((summary.converted_count / Math.max(summary.total_flagged, 1)) * 100).toFixed(1)}%`, l: 'ANOMALY CONV RATE', c: 'var(--accent-amber)' },
            { v: Number(summary.avg_z_score || 0).toFixed(2), l: 'AVG Z-SCORE', c: 'var(--accent-violet)' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.c, fontFamily: 'Syne, sans-serif' }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Type breakdown */}
      {breakdown.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {breakdown.map((b: any) => {
            const meta = TYPE_META[b.anomaly_type] || { label: b.anomaly_type, color: 'var(--accent-blue)', desc: '' };
            return (
              <div key={b.anomaly_type} className="card" style={{ padding: '14px 18px', flex: '1 1 180px' }}>
                <div style={{ fontSize: 10, color: meta.color, letterSpacing: '0.1em', fontFamily: 'DM Mono', marginBottom: 4 }}>
                  {meta.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: meta.color, fontFamily: 'Syne, sans-serif' }}>{b.count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{meta.desc}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Session Table */}
      {anomalies.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            No anomalies detected yet. The AnomalyDetectionAgent flags sessions after the Markov model is built from sufficient session data.
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Flagged Sessions</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>sorted by z-score ascending (most anomalous first)</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Session ID', 'Z-Score', 'Log P', 'Type', 'Path', 'Seq Len', 'Converted'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 10, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a: any, i: number) => {
                  const meta = TYPE_META[a.anomaly_type] || { label: a.anomaly_type, color: 'var(--accent-blue)', desc: '' };
                  const z = Number(a.z_score || 0);
                  const zColor = z < -4 ? 'var(--accent-rose)' : z < -3 ? 'var(--accent-amber)' : 'var(--text-secondary)';
                  return (
                    <tr key={a.session_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'DM Mono', fontSize: 10 }}>
                        {a.session_id.slice(0, 12)}…
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: zColor }}>{z.toFixed(2)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 10 }}>{Number(a.log_probability || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, color: meta.color, background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'DM Mono', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.path_signature}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{a.sequence_length}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {a.converted
                          ? <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>✓ Yes</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
