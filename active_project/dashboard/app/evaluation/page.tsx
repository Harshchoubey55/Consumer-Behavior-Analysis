import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Model Evaluation' };
export const revalidate = 300;

const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/evaluation`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error('');
    return res.json();
  } catch { return { hasResults: false }; }
}

export default async function EvaluationPage() {
  const data = await getData();

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1 className="font-display" style={{
            fontSize: 28, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>
            Model Evaluation
          </h1>
          <span style={{
            padding: '3px 12px', borderRadius: 20, fontSize: 10,
            fontFamily: 'DM Mono', letterSpacing: '0.1em',
            background: 'rgba(34,197,94,0.12)', color: '#22c55e',
            border: '1px solid rgba(34,197,94,0.25)',
          }}>
            RESEARCH RESULTS
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 720, lineHeight: 1.7 }}>
          Statistical validation of the contextual decision reconstruction approach.
          Three models are compared: a count-only baseline (equivalent to standard analytics),
          a context-aware logistic regression with interpretable coefficients, and a
          Random Forest. The key research question: do context features (price anchoring,
          session depth, attention signals) outperform simple event counts for predicting
          add-to-cart conversion?
        </p>
      </div>

      {data.hasResults ? (
        <EvaluationClient data={data} />
      ) : (
        <NoResults />
      )}
    </div>
  );
}

function NoResults() {
  return (
    <div style={{
      padding: '64px 32px', textAlign: 'center',
      color: 'var(--text-muted)', border: '1px dashed var(--border)',
      borderRadius: 16, fontFamily: 'DM Mono',
    }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>∅</div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>No evaluation results yet.</div>
      <div style={{ fontSize: 12, marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
        Run the pipeline in full mode to train models and compute statistical results.
        You need at least 30 decision context observations (ideally 200+).
      </div>
      <code style={{
        display: 'block', padding: '10px 20px',
        background: 'var(--bg-elevated)', borderRadius: 8,
        fontSize: 12, maxWidth: 420, margin: '0 auto',
      }}>
        python processors/pipeline.py --mode=full
      </code>
    </div>
  );
}

function EvaluationClient({ data }: { data: any }) {
  return <EvaluationView data={data} />;
}

// ── Inline client component (no 'use client' needed — purely display) ──

function EvaluationView({ data }: { data: any }) {
  const {
    modelResults, coefficients, featureImportance,
    behavioralEffects, aucComparison, dataWarning,
  } = data;

  const baselineAUC = aucComparison?.count_only;
  const contextAUC  = aucComparison?.context_lr;
  const rfAUC       = aucComparison?.context_rf;
  const improvement = aucComparison?.improvement_lr;

  return (
    <div>
      {/* Data quality warning */}
      {dataWarning && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 24,
          background: dataWarning.startsWith('⚠')
            ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${dataWarning.startsWith('⚠') ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`,
          color: dataWarning.startsWith('⚠') ? '#f59e0b' : '#22c55e',
          fontSize: 12, fontFamily: 'DM Mono',
        }}>
          {dataWarning}
        </div>
      )}

      {/* AUC Comparison — the key result */}
      <div className="card animate-in" style={{ padding: 28, marginBottom: 20 }}>
        <h3 className="font-display" style={{
          fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6,
        }}>
          Model Comparison: Context Features vs. Count-Only Baseline
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
          AUC-ROC measures how well each model distinguishes converting from
          non-converting product views. A score of 0.5 = random chance. 1.0 = perfect.
          The gap between baseline and context model quantifies the information
          value of decision context.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            {
              label: 'COUNT-ONLY BASELINE',
              sublabel: 'Logistic Regression',
              value: baselineAUC,
              color: '#4d566f',
              note: 'What standard analytics tools can predict',
            },
            {
              label: 'CONTEXT-AWARE (LR)',
              sublabel: 'Logistic Regression + Context',
              value: contextAUC,
              color: '#4f8ef7',
              note: improvement
                ? `+${(improvement * 100).toFixed(1)}pp improvement over baseline`
                : 'Context-aware model',
              highlight: true,
            },
            {
              label: 'CONTEXT-AWARE (RF)',
              sublabel: 'Random Forest + Context',
              value: rfAUC,
              color: '#22c55e',
              note: aucComparison?.improvement_rf
                ? `+${(aucComparison.improvement_rf * 100).toFixed(1)}pp over baseline`
                : 'Non-linear model',
            },
          ].map(m => (
            <div key={m.label} style={{
              padding: '20px 24px',
              background: 'var(--bg-elevated)',
              borderRadius: 12,
              border: m.highlight
                ? `1px solid ${m.color}40` : '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 10, color: m.highlight ? m.color : 'var(--text-muted)',
                fontFamily: 'DM Mono', letterSpacing: '0.08em', marginBottom: 4,
              }}>
                {m.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                {m.sublabel}
              </div>
              <div className="font-display" style={{
                fontSize: 40, fontWeight: 700, color: m.value ? m.color : 'var(--text-muted)',
                lineHeight: 1, letterSpacing: '-0.02em',
              }}>
                {m.value ?? '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'DM Mono' }}>
                AUC-ROC
              </div>
              {m.note && (
                <div style={{
                  marginTop: 10, fontSize: 11,
                  color: m.highlight ? m.color : 'var(--text-muted)',
                }}>
                  {m.note}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* AUC bar comparison */}
        {[
          { label: 'Count-only baseline', auc: baselineAUC, color: '#4d566f' },
          { label: 'Context LR', auc: contextAUC, color: '#4f8ef7' },
          { label: 'Context RF', auc: rfAUC, color: '#22c55e' },
        ].map(m => m.auc && (
          <div key={m.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
              <span style={{ color: m.color, fontFamily: 'DM Mono' }}>{m.auc}</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-base)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: m.color,
                width: `${parseFloat(m.auc) * 100}%`,
                transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Cross-validated scores */}
      {modelResults.length > 0 && (
        <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
          <h3 className="font-display" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
          }}>
            Full Evaluation Metrics
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Model', 'Features', 'N Train', 'N Test', 'AUC-ROC',
                    'Avg Precision', 'Accuracy', 'CV AUC (mean±std)'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left',
                      color: 'var(--text-muted)', fontFamily: 'DM Mono',
                      fontWeight: 400, fontSize: 10, letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelResults.map((r: any, i: number) => {
                  const isContext = r.feature_set === 'context';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, fontSize: 11 }}>
                        {r.model_name.replace('_', ' ').replace('_', ' ')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 10,
                          fontFamily: 'DM Mono',
                          background: isContext ? 'rgba(79,142,247,0.12)' : 'rgba(77,86,111,0.15)',
                          color: isContext ? '#4f8ef7' : 'var(--text-muted)',
                        }}>
                          {r.feature_set}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>{r.n_train}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>{r.n_test}</td>
                      <td style={{ padding: '10px 12px', color: '#4f8ef7', fontFamily: 'DM Mono', fontWeight: 600 }}>{r.auc_roc}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{r.avg_precision}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{r.accuracy}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>
                        {r.cv_auc_mean} ± {r.cv_auc_std}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Behavioral effects — the core research findings */}
      {behavioralEffects.length > 0 && (
        <div className="card animate-in" style={{ padding: 28, marginBottom: 20 }}>
          <h3 className="font-display" style={{
            fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6,
          }}>
            Behavioral Economics Hypothesis Tests
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Each effect is tested independently using the appropriate statistical test.
            These are the core empirical findings of the project.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {behavioralEffects.map((eff: any, i: number) => {
              const sig = eff.is_significant;
              const color = sig ? (eff.direction === 'negative' ? '#f43f5e' : '#22c55e') : 'var(--text-muted)';
              return (
                <div key={i} style={{
                  padding: '18px 20px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 12,
                  border: `1px solid ${sig ? `${color}30` : 'var(--border)'}`,
                  borderLeft: `3px solid ${color}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h4 className="font-display" style={{
                        fontSize: 14, fontWeight: 600,
                        color: 'var(--text-primary)', marginBottom: 4,
                      }}>
                        {eff.effect_name}
                      </h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 540, lineHeight: 1.5 }}>
                        {eff.description}
                      </p>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11,
                      fontFamily: 'DM Mono', whiteSpace: 'nowrap', marginLeft: 16,
                      background: sig ? `${color}15` : 'var(--bg-card)',
                      color: sig ? color : 'var(--text-muted)',
                      border: `1px solid ${sig ? `${color}30` : 'var(--border)'}`,
                    }}>
                      {sig ? '✓ SIGNIFICANT' : '✗ not significant'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Effect size (r)', value: eff.coefficient },
                      { label: 'p-value', value: eff.p_value },
                      { label: 'n', value: String(eff.sample_n) },
                      { label: 'Direction', value: eff.direction },
                    ].map(s => (
                      <div key={s.label} style={{
                        padding: '6px 12px',
                        background: 'var(--bg-base)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'DM Mono', letterSpacing: '0.06em', marginBottom: 2 }}>
                          {s.label.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 13, color, fontFamily: 'DM Mono', fontWeight: 500 }}>
                          {s.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {eff.interpretation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Logistic regression coefficients */}
      {coefficients.length > 0 && (
        <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
          <h3 className="font-display" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6,
          }}>
            Logistic Regression Coefficients (Context Model)
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Coefficients are on standardised features. Positive = increases conversion probability.
            Odds ratio: how many times more likely to convert per unit increase. Bold = p&lt;0.05.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Feature', 'Coef', 'SE', 'p-value', 'Odds Ratio', '95% CI', 'Sig'].map(h => (
                    <th key={h} style={{
                      padding: '6px 10px', textAlign: 'left',
                      color: 'var(--text-muted)', fontFamily: 'DM Mono',
                      fontWeight: 400, fontSize: 10, letterSpacing: '0.06em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coefficients.map((c: any, i: number) => {
                  const sig = c.is_significant;
                  const coef = parseFloat(c.coefficient);
                  const coefColor = coef > 0 ? '#22c55e' : '#f43f5e';
                  return (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--border)',
                      background: sig ? 'rgba(255,255,255,0.01)' : 'transparent',
                      fontWeight: sig ? 600 : 400,
                    }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>
                        {c.feature_name}
                      </td>
                      <td style={{ padding: '8px 10px', color: coefColor, fontFamily: 'DM Mono' }}>
                        {c.coefficient}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                        {c.std_error ?? '—'}
                      </td>
                      <td style={{ padding: '8px 10px', color: sig ? '#f59e0b' : 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                        {c.p_value ?? '—'}
                      </td>
                      <td style={{ padding: '8px 10px', color: coefColor, fontFamily: 'DM Mono' }}>
                        {c.odds_ratio}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 10 }}>
                        {c.ci_lower && c.ci_upper ? `[${c.ci_lower}, ${c.ci_upper}]` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {sig === true ? <span style={{ color: '#22c55e' }}>✓</span>
                         : sig === false ? <span style={{ color: 'var(--text-muted)' }}>✗</span>
                         : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feature importance */}
      {featureImportance.length > 0 && (
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6,
          }}>
            Feature Importance (Random Forest — Permutation Method)
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
            How much AUC drops when each feature is randomly permuted (shuffled).
            Higher = more important. Error bars show variability across 20 permutations.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {featureImportance.map((fi: any) => {
              const imp = parseFloat(fi.importance);
              const maxImp = parseFloat(featureImportance[0].importance) || 1;
              const pct = Math.max(0, imp / maxImp) * 100;
              const color = fi.rank <= 3 ? '#f59e0b' : fi.rank <= 6 ? '#4f8ef7' : '#4d566f';
              return (
                <div key={fi.feature_name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono',
                        minWidth: 20,
                      }}>
                        #{fi.rank}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{fi.feature_name}</span>
                    </div>
                    <span style={{ color, fontFamily: 'DM Mono' }}>
                      {imp.toFixed(4)} ± {parseFloat(fi.std_dev).toFixed(4)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, background: color,
                      width: `${pct}%`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
