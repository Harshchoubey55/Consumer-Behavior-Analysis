import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Adaptive Interventions' };
export const revalidate = 300;

const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/interventions`, { cache: 'no-store' });
    if (!res.ok) throw new Error('');
    return res.json();
  } catch { return { arms: [], uplift: [], recentLogs: [] }; }
}

export default async function InterventionsPage() {
  const data = await getData();

  const { arms, uplift, recentLogs } = data;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1 className="font-display" style={{
            fontSize: 28, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>
            Adaptive Interventions
          </h1>
          <span style={{
            padding: '3px 12px', borderRadius: 20, fontSize: 10,
            fontFamily: 'DM Mono', letterSpacing: '0.1em',
            background: 'rgba(236,72,153,0.12)', color: '#ec4899',
            border: '1px solid rgba(236,72,153,0.25)',
          }}>
            CAUSAL REINFORCEMENT LEARNING
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 720, lineHeight: 1.7 }}>
          Live view of the Contextual Bandit continuously balancing exploration and exploitation
          for real-time storefront UI adaptation. We use Inverse Probability Weighting (IPW) on observational intervention logs to evaluate the causal uplift.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Bandit Arms Activity */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            Contextual Bandit Arms
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {arms && arms.length > 0 ? arms.map((arm: any) => (
              <div key={arm.arm_name} style={{
                padding: '16px', background: 'var(--bg-elevated)', borderRadius: 8,
                border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {arm.arm_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {arm.pulls} pulls, {arm.conversions} conversions
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, color: '#ec4899', fontFamily: 'DM Mono', fontWeight: 600 }}>
                    {arm.empirical_conversion_rate}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Empirical Rate</div>
                </div>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No arms tracking data yet.</div>
            )}
          </div>
        </div>

        {/* Causal Uplift */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            Causal IPW Uplift vs. Control (NONE)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {uplift && uplift.length > 0 ? uplift.map((u: any) => (
              <div key={u.intervention} style={{
                padding: '16px', background: 'var(--bg-elevated)', borderRadius: 8,
                border: u.is_significant ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{u.intervention}</span>
                  {u.is_significant && (
                    <span style={{ fontSize: 10, color: '#22c55e', padding: '2px 8px', background: 'rgba(34,197,94,0.1)', borderRadius: 12 }}>
                      SIGNIFICANT
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                  <div>
                     <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>UPLIFT</div>
                     <div style={{ fontSize: 13, color: parseFloat(u.relative_lift) > 0 ? '#22c55e' : '#f43f5e', fontFamily: 'DM Mono' }}>
                       {parseFloat(u.relative_lift) > 0 ? '+' : ''}{(parseFloat(u.relative_lift) * 100).toFixed(1)}%
                     </div>
                  </div>
                  <div>
                     <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>IPW ATE</div>
                     <div style={{ fontSize: 13, fontFamily: 'DM Mono' }}>{parseFloat(u.ipw_ate).toFixed(4)}</div>
                  </div>
                  <div>
                     <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>P-VALUE</div>
                     <div style={{ fontSize: 13, fontFamily: 'DM Mono' }}>{parseFloat(u.p_value).toFixed(4)}</div>
                  </div>
                  <div>
                     <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>SAMPLE</div>
                     <div style={{ fontSize: 13, fontFamily: 'DM Mono' }}>{u.sample_size}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 12 }}>
                Run the evaluation engine to compute Causal Uplift (needs &ge; 10 logs).
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            Recent Intervention Logs
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 400 }}>Session ID</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 400 }}>Assigned Arm</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 400 }}>Propensity</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 400 }}>Outcome</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 400 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs && recentLogs.length > 0 ? recentLogs.map((log: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontFamily: 'DM Mono', color: 'var(--text-secondary)' }}>{log.session_id.substring(0, 16)}...</td>
                    <td style={{ padding: '8px', fontWeight: 600, color: log.assigned_arm === 'NONE' ? 'var(--text-muted)' : '#ec4899' }}>{log.assigned_arm}</td>
                    <td style={{ padding: '8px', fontFamily: 'DM Mono' }}>{parseFloat(log.propensity).toFixed(4)}</td>
                    <td style={{ padding: '8px', color: log.outcome ? '#22c55e' : 'var(--text-muted)' }}>{log.outcome ? 'Converted' : 'Pending/Fail'}</td>
                    <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No logs captured yet. Check your storefront telemetry.</td></tr>
                )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
