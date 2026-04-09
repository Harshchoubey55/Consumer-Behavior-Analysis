'use client';

import { useState } from 'react';

const CATEGORY_LABELS: Record<string, string> = {
  product_issue: 'Product Issue',
  funnel_issue: 'Funnel Issue',
  engagement: 'Engagement',
  pricing: 'Pricing',
};

const CATEGORY_ICONS: Record<string, string> = {
  product_issue: '◻',
  funnel_issue: '⌥',
  engagement: '◎',
  pricing: '⊞',
};

export default function RecommendationsClient({ data }: { data: any }) {
  const { recommendations, summary } = data;
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? recommendations
    : recommendations.filter((r: any) => r.category === filter || r.severity === filter);

  const criticalCount = recommendations.filter((r: any) => r.severity === 'critical').length;
  const warningCount = recommendations.filter((r: any) => r.severity === 'warning').length;

  return (
    <div>
      {/* Summary cards */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div className="card animate-in" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'DM Mono' }}>TOTAL INSIGHTS</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>{recommendations.length}</div>
        </div>
        <div className="card animate-in" style={{ padding: '18px 20px', borderColor: criticalCount > 0 ? 'rgba(244,63,94,0.3)' : undefined }}>
          <div style={{ fontSize: 10, color: '#f43f5e', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'DM Mono' }}>CRITICAL</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 700, color: '#f43f5e' }}>{criticalCount}</div>
        </div>
        <div className="card animate-in" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'DM Mono' }}>WARNINGS</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b' }}>{warningCount}</div>
        </div>
        <div className="card animate-in" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'DM Mono' }}>CATEGORIES</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>{(summary || []).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'critical', 'warning', 'product_issue', 'funnel_issue', 'engagement'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 11,
            fontFamily: 'DM Mono', cursor: 'pointer',
            background: filter === f ? 'rgba(79,142,247,0.15)' : 'var(--bg-elevated)',
            color: filter === f ? '#4f8ef7' : 'var(--text-secondary)',
            border: `1px solid ${filter === f ? 'rgba(79,142,247,0.3)' : 'var(--border)'}`,
            textTransform: 'capitalize',
          }}>
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Recommendation cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
            No insights match this filter.
          </div>
        ) : filtered.map((rec: any, i: number) => {
          const severityColors: Record<string, string> = {
            critical: '#f43f5e',
            warning: '#f59e0b',
            info: '#4f8ef7',
          };
          const color = severityColors[rec.severity] || '#4f8ef7';

          return (
            <div key={rec.rec_id} className="card animate-in" style={{
              padding: 24,
              animationDelay: `${i * 0.05}s`,
              borderLeft: `3px solid ${color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge-${rec.severity}`} style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontFamily: 'DM Mono', letterSpacing: '0.08em' }}>
                    {rec.severity.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                    {CATEGORY_ICONS[rec.category]} {CATEGORY_LABELS[rec.category] || rec.category}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>{rec.generated_at}</span>
              </div>

              <h4 className="font-display" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                {rec.title}
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                {rec.description}
              </p>

              {rec.metric_value && (
                <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                  <div style={{ padding: '8px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono', marginBottom: 4 }}>
                      {(rec.metric_label || '').toUpperCase().replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'DM Mono' }}>
                      {rec.metric_label?.includes('rate') || rec.metric_label?.includes('prob')
                        ? `${(parseFloat(rec.metric_value) * 100).toFixed(1)}%`
                        : rec.metric_value}
                    </div>
                  </div>
                </div>
              )}

              {rec.action_suggested && (
                <div style={{ padding: '12px 16px', background: 'rgba(79,142,247,0.06)', borderRadius: 8, border: '1px solid rgba(79,142,247,0.15)' }}>
                  <div style={{ fontSize: 10, color: '#4f8ef7', fontFamily: 'DM Mono', letterSpacing: '0.08em', marginBottom: 6 }}>
                    SUGGESTED ACTION
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {rec.action_suggested}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
