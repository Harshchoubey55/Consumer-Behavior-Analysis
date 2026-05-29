import { Suspense } from 'react';
export const metadata = { title: 'Behavioral Archetypes' };
export const revalidate = 120;

const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/phenotypes`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function StatBadge({ value, label, color = 'var(--accent-blue)' }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const ARCHETYPE_COLORS: Record<string, string> = {
  COMPARISON_SHOPPER: 'var(--accent-blue)',
  PRICE_SENSITIVE:    'var(--accent-amber)',
  DEEP_RESEARCHER:    'var(--accent-teal)',
  BROAD_EXPLORER:     'var(--accent-violet)',
  CATEGORY_HOPPER:    'var(--accent-rose)',
  INTENT_DRIVEN:      'var(--accent-green)',
  DELIBERATE_RESEARCHER: 'var(--accent-teal)',
  SEARCH_DRIVEN:      'var(--accent-blue)',
};

function archetypeColor(code: string): string {
  const base = code.replace(/_\d+$/, '');
  return ARCHETYPE_COLORS[base] || 'var(--accent-blue)';
}

export default async function PhenotypesPage() {
  const data = await getData();

  const profiles = data?.profiles || [];
  const drift    = data?.drift    || [];
  const anova    = data?.anova    || null;
  const gm       = data?.globalModel || null;
  const federated = data?.federated || [];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Behavioral Archetypes
          </h1>
          <span style={{ fontSize: 12, color: 'var(--accent-violet)', fontFamily: 'DM Mono', background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(139,92,246,0.2)' }}>
            INTELLIGENCE
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 640 }}>
          Unsupervised K-Means clustering of decision context features discovers latent consumer archetypes.
          ANOVA validates that conversion rates differ significantly across phenotypes.
          Dynamically named from dominant centroid features — no hard-coded labels.
        </p>
      </div>

      {/* ANOVA Summary */}
      {anova && (
        <div className="card" style={{ padding: '20px 28px', marginBottom: 24, display: 'flex', gap: 40, alignItems: 'center' }}>
          <StatBadge value={anova.cluster_k} label="OPTIMAL K" color="var(--accent-violet)" />
          <StatBadge value={Number(anova.silhouette_score || 0).toFixed(3)} label="SILHOUETTE" color="var(--accent-blue)" />
          <StatBadge value={`F=${Number(anova.anova_f_stat || 0).toFixed(2)}`} label="ANOVA F-STAT" color="var(--accent-teal)" />
          <StatBadge
            value={`p=${Number(anova.anova_p_value || 1).toFixed(4)}`}
            label="P-VALUE"
            color={anova.anova_significant ? 'var(--accent-green)' : 'var(--accent-rose)'}
          />
          <div style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            ...(anova.anova_significant
              ? { background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)', border: '1px solid rgba(34,197,94,0.25)' }
              : { background: 'rgba(244,63,94,0.12)', color: 'var(--accent-rose)',  border: '1px solid rgba(244,63,94,0.25)' })
          }}>
            {anova.anova_significant ? '✓ STATISTICALLY SIGNIFICANT' : '✗ NOT SIGNIFICANT'}
          </div>
        </div>
      )}

      {/* Phenotype Profiles */}
      {profiles.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◆</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            No phenotypes discovered yet. The PhenotypeAgent runs in <code style={{ color: 'var(--accent-blue)' }}>--mode=full</code> after ≥10 sessions with decision context data are collected.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }} className="stagger">
          {profiles.map((p: any) => {
            const color = archetypeColor(p.archetype_code);
            const convPct = (Number(p.conversion_rate || 0) * 100).toFixed(1);
            return (
              <div key={p.phenotype_index} className="card animate-in" style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color, letterSpacing: '0.1em', fontFamily: 'DM Mono', marginBottom: 4 }}>
                      {p.archetype_code}
                    </div>
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {p.phenotype_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Syne, sans-serif' }}>{convPct}%</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>CONV. RATE</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                  <div>Prior views <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Number(p.avg_prior_views || 0).toFixed(1)}</span></div>
                  <div>Scroll depth <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Number(p.avg_scroll_depth || 0).toFixed(0)}%</span></div>
                  <div>Price Δ <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Number(p.avg_price_vs_median || 0).toFixed(0)}%</span></div>
                  <div>Sessions <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.sample_size}</span></div>
                </div>
                {/* Conversion bar */}
                <div style={{ marginTop: 14, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div className="bar-fill" style={{ height: '100%', borderRadius: 2, background: color, width: `${Math.min(100, Number(p.conversion_rate || 0) * 100 * 3)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Behavioral Drift */}
      {drift.length > 0 && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
          <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
            Cross-Session Behavioral Drift
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Users whose archetype assignment changed between sessions. Indicates evolving purchase intent or decision style.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {drift.map((d: any, i: number) => (
              <div key={i} style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.15)', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>
                {d.drift_type}
                <span style={{ marginLeft: 8, color: 'var(--accent-blue)', fontWeight: 600 }}>×{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FedAvg Section */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Federated Behavioral Phenotyping
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 560 }}>
              FedAvg-inspired: archetypes inferred from on-device gradient updates (Δw), not raw interaction data.
              The server never sees individual browsing events — only compressed gradient vectors.
            </p>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 5, fontSize: 10, fontFamily: 'DM Mono', color: 'var(--accent-violet)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', whiteSpace: 'nowrap' }}>
            FEDAVG-INSPIRED
          </div>
        </div>

        {gm && (
          <div style={{ display: 'flex', gap: 32, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <StatBadge value={gm.n_rounds} label="ROUNDS" color="var(--accent-violet)" />
            <StatBadge value={gm.n_total_samples} label="TOTAL SAMPLES" color="var(--accent-blue)" />
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono', alignSelf: 'center' }}>
              Last updated: {gm.last_updated ? new Date(gm.last_updated).toLocaleString() : 'Never'}
            </div>
          </div>
        )}

        {federated.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
            Federated phenotypes accumulate as users browse ≥3 products per session. Updates aggregate on each full pipeline run.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {federated.map((f: any, i: number) => (
              <div key={i} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', fontSize: 12 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{f.cluster_name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, fontFamily: 'DM Mono' }}>
                  {f.count} sessions · Δ|w|={Number(f.avg_delta_magnitude || 0).toFixed(3)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
