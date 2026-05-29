export const metadata = { title: 'Agent Health' };
export const revalidate = 30;

const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/agents`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
  COMPLETED: { color: 'var(--accent-green)',  bg: 'rgba(34,197,94,0.12)',   icon: '✓' },
  RUNNING:   { color: 'var(--accent-blue)',   bg: 'rgba(79,142,247,0.12)',  icon: '◌' },
  FAILED:    { color: 'var(--accent-rose)',   bg: 'rgba(244,63,94,0.12)',   icon: '✗' },
  SKIPPED:   { color: 'var(--accent-amber)',  bg: 'rgba(245,158,11,0.12)',  icon: '⊘' },
  PENDING:   { color: 'var(--text-muted)',    bg: 'rgba(255,255,255,0.04)', icon: '○' },
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  SessionizationAgent:     'Aggregates raw events into session records',
  ProductAnalyticsAgent:   'Per-product engagement & conversion metrics',
  UserFeatureAgent:        'ML-ready behavioral features per user',
  KPIAgent:                'Daily KPI snapshots (conversion, bounce rate)',
  FunnelAgent:             'Drop-off funnel analysis',
  RecommendationAgent:     'Prescriptive recommendations for products/users',
  SequenceModelAgent:      'Markov transition matrix construction',
  ContextAnalysisAgent:    'Decision context reconstruction — novel core',
  InterventionAgent:       'A/B experiment reward backfill',
  AnomalyDetectionAgent:   'Improbable path detection via log-probability',
  PhenotypeAgent:          'K-Means behavioral archetype discovery',
  EvaluationAgent:         'Statistical model evaluation (full mode)',
  FedAvgAgent:             'FedAvg gradient aggregation (full mode)',
};

function formatMs(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTs(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

export default async function AgentsPage() {
  const data = await getData();
  const agents     = data?.agents     || [];
  const latestRun  = data?.latestRun  || null;
  const history    = data?.history    || [];

  const completed = agents.filter((a: any) => a.status === 'COMPLETED').length;
  const failed    = agents.filter((a: any) => a.status === 'FAILED').length;
  const skipped   = agents.filter((a: any) => a.status === 'SKIPPED').length;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Agent Health Monitor
          </h1>
          <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontFamily: 'DM Mono', background: 'rgba(79,142,247,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(79,142,247,0.2)' }}>
            PIPELINE ORCHESTRATOR
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 600 }}>
          All analytics pipeline stages are autonomous agents with declared dependencies.
          The orchestrator runs them in parallel where dependencies allow, logging
          every execution to this health monitor.
        </p>
      </div>

      {/* Latest run summary */}
      {latestRun ? (
        <div className="card" style={{ padding: '16px 24px', marginBottom: 24, display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>RUN ID</div>
            <div style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text-secondary)' }}>{latestRun.run_id?.slice(0, 16)}…</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>MODE</div>
            <div style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>{latestRun.pipeline_mode}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>STARTED</div>
            <div style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text-secondary)' }}>{formatTs(latestRun.created_at)}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
            {[
              { n: completed, l: 'COMPLETED', c: 'var(--accent-green)' },
              { n: skipped,   l: 'SKIPPED',   c: 'var(--accent-amber)' },
              { n: failed,    l: 'FAILED',     c: 'var(--accent-rose)'  },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.c, fontFamily: 'Syne, sans-serif' }}>{s.n}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            No pipeline runs recorded yet. Agents log to the <code style={{ color: 'var(--accent-blue)' }}>agent_runs</code> table on each execution.
          </div>
        </div>
      )}

      {/* Agent status table */}
      {agents.length > 0 && (
        <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Agent Execution — Latest Run
          </div>
          <div>
            {agents.map((a: any, i: number) => {
              const meta = STATUS_META[a.status] || STATUS_META.PENDING;
              const desc = AGENT_DESCRIPTIONS[a.agent_name] || '';
              return (
                <div key={a.agent_name} style={{
                  display: 'grid',
                  gridTemplateColumns: '200px 80px 70px 70px 80px 1fr',
                  gap: 12,
                  padding: '12px 20px',
                  borderBottom: i < agents.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  alignItems: 'center',
                  background: a.status === 'FAILED' ? 'rgba(244,63,94,0.04)' : 'transparent',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.agent_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>v{a.agent_version}</div>
                  </div>
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'DM Mono', color: meta.color, background: meta.bg }}>
                      <span>{meta.icon}</span> {a.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>
                    {formatMs(a.duration_ms)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>
                    {a.rows_processed != null ? `${a.rows_processed} rows` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                    {formatTs(a.started_at)}
                  </div>
                  <div style={{ fontSize: 11, color: a.error_message ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                    {a.error_message ? `⚠ ${a.error_message.slice(0, 80)}` : desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Run history */}
      {history.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            Pipeline Run History
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Started', 'Mode', 'Agents', '✓', '✗', '⊘', 'Duration'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 16px', color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 10, letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h: any, i: number) => (
                  <tr key={h.run_id} style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <td style={{ padding: '9px 16px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-secondary)' }}>{formatTs(h.started_at)}</td>
                    <td style={{ padding: '9px 16px', fontSize: 11, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>{h.pipeline_mode}</td>
                    <td style={{ padding: '9px 16px', color: 'var(--text-secondary)' }}>{h.total_agents}</td>
                    <td style={{ padding: '9px 16px', color: 'var(--accent-green)', fontWeight: 600 }}>{h.completed}</td>
                    <td style={{ padding: '9px 16px', color: Number(h.failed) > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>{h.failed}</td>
                    <td style={{ padding: '9px 16px', color: 'var(--accent-amber)' }}>{h.skipped}</td>
                    <td style={{ padding: '9px 16px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-secondary)' }}>{formatMs(h.total_duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
