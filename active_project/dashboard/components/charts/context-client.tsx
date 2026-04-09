'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────
type Insight = {
  insight_id: string;
  product_id: string;
  product_title: string;
  insight_type: string;
  severity: string;
  title: string;
  finding: string;
  evidence: string;
  action: string;
  high_context: string;
  low_context: string;
  high_rate: string;
  low_rate: string;
  rate_difference: string;
  relative_lift: string;
  sample_size: number;
  generated_at: string;
};

type HeatmapRow = {
  product_id: string;
  product_title: string;
  context_dimension: string;
  bin_label: string;
  bin_order: number;
  view_count: number;
  conversion_rate: string;
  baseline_rate: string;
  lift: string;
  is_significant: boolean;
};

type ContextData = {
  insights: Insight[];
  heatmap: HeatmapRow[];
  insightTypeDist: { insight_type: string; count: string; avg_lift: string }[];
  contextSensitiveProducts: {
    product_id: string;
    product_title: string;
    insight_count: string;
    max_lift: string;
    max_rate_diff: string;
    severities: string;
  }[];
  dimensionSummary: {
    context_dimension: string;
    significant_products: string;
    avg_max_lift: string;
    total_observations: string;
  }[];
  sessionContextDist: { metric: string; avg_value: string; p25: string; p75: string }[];
};

// ── Helpers ──────────────────────────────────────────────────────
const INSIGHT_TYPE_LABELS: Record<string, string> = {
  comparison_fatigue:  'Comparison Fatigue',
  first_impression:    'First Impression',
  price_anchor_high:   'Price Anchoring ↑',
  price_anchor_low:    'Price Anchoring ↓',
  attention_depth:     'Attention Depth',
  search_intent:       'Search Intent',
  category_saturation: 'Category Saturation',
  return_viewer:       'Return Viewer',
  time_of_day:         'Time of Day',
};

const INSIGHT_TYPE_ICONS: Record<string, string> = {
  comparison_fatigue:  '⊘',
  first_impression:    '◎',
  price_anchor_high:   '↑',
  price_anchor_low:    '↓',
  attention_depth:     '◉',
  search_intent:       '⌕',
  category_saturation: '≋',
  return_viewer:       '↺',
  time_of_day:         '◷',
};

const INSIGHT_TYPE_COLORS: Record<string, string> = {
  comparison_fatigue:  '#f43f5e',
  first_impression:    '#4f8ef7',
  price_anchor_high:   '#f59e0b',
  price_anchor_low:    '#22c55e',
  attention_depth:     '#8b5cf6',
  search_intent:       '#2dd4bf',
  category_saturation: '#f97316',
  return_viewer:       '#06b6d4',
  time_of_day:         '#a78bfa',
};

const DIM_LABELS: Record<string, string> = {
  prior_product_views:        'Session Depth',
  price_vs_median_pct:        'Price Position',
  session_duration_so_far_s:  'Session Time',
  scroll_depth_pct:           'Scroll Depth',
  time_on_page_before_ms:     'Page Dwell',
  same_category_views_before: 'Category Views',
  hour_of_day:                'Time of Day',
  is_from_search:             'Arrival Mode',
  is_return_view:             'Return View',
};

const tooltipStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 11,
  fontFamily: 'DM Mono',
  color: 'var(--text-primary)',
};

function liftColor(lift: number): string {
  if (lift >= 2.5) return '#22c55e';
  if (lift >= 1.5) return '#4f8ef7';
  if (lift >= 1.0) return '#f59e0b';
  return '#f43f5e';
}

function severityColor(s: string): string {
  return s === 'critical' ? '#f43f5e' : s === 'warning' ? '#f59e0b' : '#4f8ef7';
}

// ── Sub-components ───────────────────────────────────────────────

function InsightCard({ insight, expanded, onToggle }: {
  insight: Insight;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lift = parseFloat(insight.relative_lift);
  const sColor = severityColor(insight.severity);
  const typeColor = INSIGHT_TYPE_COLORS[insight.insight_type] || '#4f8ef7';
  const typeLabel = INSIGHT_TYPE_LABELS[insight.insight_type] || insight.insight_type;
  const typeIcon = INSIGHT_TYPE_ICONS[insight.insight_type] || '◈';

  return (
    <div
      className="card animate-in"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderLeft: `3px solid ${sColor}`,
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      {/* Header row */}
      <div style={{ padding: '18px 20px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', gap: 16, marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Severity badge */}
            <span style={{
              padding: '2px 10px', borderRadius: 20, fontSize: 10,
              fontFamily: 'DM Mono', letterSpacing: '0.08em',
              background: `${sColor}18`, color: sColor,
              border: `1px solid ${sColor}40`,
            }}>
              {insight.severity.toUpperCase()}
            </span>
            {/* Insight type badge */}
            <span style={{
              padding: '2px 10px', borderRadius: 20, fontSize: 10,
              fontFamily: 'DM Mono',
              background: `${typeColor}14`, color: typeColor,
              border: `1px solid ${typeColor}30`,
            }}>
              {typeIcon} {typeLabel}
            </span>
          </div>
          {/* Lift metric */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 22, fontWeight: 700, fontFamily: 'DM Mono',
              color: liftColor(lift), lineHeight: 1,
            }}>
              {lift.toFixed(1)}×
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>lift</div>
          </div>
        </div>

        <h4 className="font-display" style={{
          fontSize: 14, fontWeight: 600,
          color: 'var(--text-primary)', marginBottom: 6,
        }}>
          {insight.title}
        </h4>

        {/* Rate comparison bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          borderRadius: 8, marginBottom: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono', marginBottom: 4 }}>
              BEST: {insight.high_context}
            </div>
            <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, background: '#22c55e',
                width: `${Math.min(parseFloat(insight.high_rate) * 3, 100)}%`,
              }} />
            </div>
            <div style={{ fontSize: 12, color: '#22c55e', fontFamily: 'DM Mono', marginTop: 3, fontWeight: 500 }}>
              {insight.high_rate}% conversion
            </div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>vs</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono', marginBottom: 4 }}>
              WORST: {insight.low_context}
            </div>
            <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, background: '#f43f5e',
                width: `${Math.min(parseFloat(insight.low_rate) * 3, 100)}%`,
              }} />
            </div>
            <div style={{ fontSize: 12, color: '#f43f5e', fontFamily: 'DM Mono', marginTop: 3, fontWeight: 500 }}>
              {insight.low_rate}% conversion
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{insight.product_title}</span>
          <span>{expanded ? '▲ collapse' : '▼ details'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Finding */}
          <div>
            <div style={{
              fontSize: 10, color: 'var(--accent-blue)',
              fontFamily: 'DM Mono', letterSpacing: '0.08em', marginBottom: 6,
            }}>
              FINDING
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {insight.finding}
            </p>
          </div>

          {/* Evidence */}
          <div style={{
            padding: '10px 14px',
            background: 'rgba(79,142,247,0.05)',
            borderRadius: 8,
            border: '1px solid rgba(79,142,247,0.12)',
          }}>
            <div style={{
              fontSize: 10, color: '#4f8ef7',
              fontFamily: 'DM Mono', letterSpacing: '0.08em', marginBottom: 6,
            }}>
              STATISTICAL EVIDENCE
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {insight.evidence}
            </p>
          </div>

          {/* Action */}
          <div style={{
            padding: '10px 14px',
            background: 'rgba(34,197,94,0.05)',
            borderRadius: 8,
            border: '1px solid rgba(34,197,94,0.15)',
          }}>
            <div style={{
              fontSize: 10, color: '#22c55e',
              fontFamily: 'DM Mono', letterSpacing: '0.08em', marginBottom: 6,
            }}>
              RECOMMENDED ACTION
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {insight.action}
            </p>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
            Generated: {insight.generated_at} · Sample: {insight.sample_size} observations
          </div>
        </div>
      )}
    </div>
  );
}

// ── Conditional Rate Heatmap ─────────────────────────────────────
function ConditionalHeatmap({ heatmap }: { heatmap: HeatmapRow[] }) {
  const [selectedDim, setSelectedDim] = useState<string>('prior_product_views');

  const dims = useMemo(() => {
    const s = new Set(heatmap.map(r => r.context_dimension));
    return Array.from(s).sort();
  }, [heatmap]);

  // Get products with data for selected dim
  const filteredRows = heatmap.filter(r => r.context_dimension === selectedDim);
  const products = useMemo(() => {
    const s = new Set(filteredRows.map(r => r.product_id));
    return Array.from(s).slice(0, 8); // max 8 products for readability
  }, [filteredRows]);

  const bins = useMemo(() => {
    const s = new Map<string, number>();
    filteredRows.forEach(r => s.set(r.bin_label, r.bin_order));
    return Array.from(s.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([label]) => label);
  }, [filteredRows]);

  // Build cell lookup: product_id × bin_label → rate
  const cellMap = useMemo(() => {
    const m: Record<string, Record<string, { rate: number; lift: number; sig: boolean; views: number }>> = {};
    filteredRows.forEach(r => {
      if (!m[r.product_id]) m[r.product_id] = {};
      m[r.product_id][r.bin_label] = {
        rate: parseFloat(r.conversion_rate),
        lift: parseFloat(r.lift),
        sig: r.is_significant,
        views: r.view_count,
      };
    });
    return m;
  }, [filteredRows]);

  function cellBg(rate: number, sig: boolean): string {
    if (rate === undefined || isNaN(rate)) return 'var(--bg-elevated)';
    // Scale: 0% = dark red, 15%+ = bright green
    const pct = Math.min(rate / 15, 1);
    const r = Math.round(244 - pct * (244 - 34));
    const g = Math.round(63  + pct * (197 - 63));
    const b = Math.round(94  + pct * (94  - 94));
    return `rgba(${r},${g},${b},${sig ? 0.35 : 0.15})`;
  }

  const productTitleMap: Record<string, string> = {};
  filteredRows.forEach(r => { productTitleMap[r.product_id] = r.product_title; });

  return (
    <div>
      {/* Dimension selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {dims.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDim(d)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11,
              fontFamily: 'DM Mono', cursor: 'pointer',
              background: selectedDim === d ? 'rgba(245,158,11,0.15)' : 'var(--bg-elevated)',
              color: selectedDim === d ? '#f59e0b' : 'var(--text-muted)',
              border: `1px solid ${selectedDim === d ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
            }}
          >
            {DIM_LABELS[d] || d}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          No data for this dimension yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{
                  padding: '8px 12px', textAlign: 'left',
                  color: 'var(--text-muted)', fontFamily: 'DM Mono',
                  fontWeight: 400, fontSize: 10, letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}>
                  PRODUCT
                </th>
                {bins.map(bin => (
                  <th key={bin} style={{
                    padding: '6px 8px', textAlign: 'center',
                    color: 'var(--text-muted)', fontFamily: 'DM Mono',
                    fontWeight: 400, fontSize: 10, letterSpacing: '0.04em',
                    whiteSpace: 'nowrap', maxWidth: 100,
                  }}>
                    {bin}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(pid => (
                <tr key={pid}>
                  <td style={{
                    padding: '8px 12px', color: 'var(--text-secondary)',
                    fontFamily: 'DM Mono', fontSize: 11,
                    whiteSpace: 'nowrap', maxWidth: 160,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {productTitleMap[pid] || pid}
                  </td>
                  {bins.map(bin => {
                    const cell = cellMap[pid]?.[bin];
                    const rate = cell?.rate;
                    const sig = cell?.sig ?? false;
                    const views = cell?.views ?? 0;
                    return (
                      <td
                        key={bin}
                        title={rate !== undefined
                          ? `${rate.toFixed(1)}% conversion (${views} views)${sig ? ' ✓ significant' : ''}`
                          : 'No data'}
                        style={{
                          padding: '8px 10px',
                          textAlign: 'center',
                          borderRadius: 6,
                          background: rate !== undefined ? cellBg(rate, sig) : 'var(--bg-elevated)',
                          color: rate !== undefined ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontFamily: 'DM Mono',
                          fontWeight: sig ? 600 : 400,
                          border: sig ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                          cursor: 'default',
                        }}
                      >
                        {rate !== undefined ? `${rate.toFixed(0)}%` : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{
            marginTop: 10, fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'DM Mono', display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <span>Color = conversion rate (red=low, green=high)</span>
            <span>Bold border = statistically significant (p&lt;0.05)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────
export default function ContextClient({ data }: { data: ContextData }) {
  const {
    insights, heatmap, insightTypeDist,
    contextSensitiveProducts, dimensionSummary, sessionContextDist,
  } = data;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');

  const filteredInsights = insights.filter(ins => {
    if (typeFilter !== 'all' && ins.insight_type !== typeFilter) return false;
    if (sevFilter !== 'all' && ins.severity !== sevFilter) return false;
    return true;
  });

  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount  = insights.filter(i => i.severity === 'warning').length;
  const avgLift = insights.length
    ? (insights.reduce((s, i) => s + parseFloat(i.relative_lift), 0) / insights.length).toFixed(1)
    : '—';

  const radarData = dimensionSummary
    .filter(d => d.avg_max_lift && parseFloat(d.avg_max_lift) > 0)
    .slice(0, 7)
    .map(d => ({
      dim: DIM_LABELS[d.context_dimension] || d.context_dimension,
      lift: parseFloat(d.avg_max_lift || '0'),
      products: parseInt(d.significant_products || '0'),
    }));

  return (
    <div>
      {/* ── KPI bar ─────────────────────────────────────── */}
      <div className="stagger" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 28,
      }}>
        {[
          { label: 'CONTEXT INSIGHTS',  value: String(insights.length),  color: '#4f8ef7' },
          { label: 'CRITICAL',          value: String(criticalCount),     color: '#f43f5e' },
          { label: 'WARNINGS',          value: String(warningCount),      color: '#f59e0b' },
          { label: 'AVG LIFT FACTOR',   value: avgLift + '×',             color: '#22c55e' },
        ].map(k => (
          <div key={k.label} className="card animate-in" style={{ padding: '20px 24px' }}>
            <div style={{
              fontSize: 10, color: k.color,
              fontFamily: 'DM Mono', letterSpacing: '0.1em', marginBottom: 8,
            }}>
              {k.label}
            </div>
            <div className="font-display" style={{
              fontSize: 36, fontWeight: 700, color: k.color,
              letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Session context snapshot ─────────────────────── */}
      {sessionContextDist.length > 0 && (
        <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
          <h3 className="font-display" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4,
          }}>
            Typical Decision Context Across All Sessions
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            What the average browsing context looks like at the moment of a product decision.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {sessionContextDist.map(s => (
              <div key={s.metric} style={{
                padding: '14px 16px',
                background: 'var(--bg-elevated)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: 'DM Mono', marginBottom: 6,
                }}>
                  {s.metric}
                </div>
                <div style={{
                  fontSize: 24, fontWeight: 700,
                  color: 'var(--text-primary)', fontFamily: 'DM Mono',
                }}>
                  {parseFloat(s.avg_value).toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  p25: {parseFloat(s.p25).toFixed(1)} · p75: {parseFloat(s.p75).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Middle row: radar + type dist ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Dimension effectiveness radar */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4,
          }}>
            Context Dimension Effectiveness
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Which context variables produce the highest conversion lift when significant
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="dim"
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'DM Mono' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 'auto']}
                tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                tickCount={3}
              />
              <Radar
                name="Avg Lift"
                dataKey="lift"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Insight type distribution */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4,
          }}>
            Insight Type Distribution
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            What kinds of context effects are most prevalent across products
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insightTypeDist.map(t => {
              const color = INSIGHT_TYPE_COLORS[t.insight_type] || '#4f8ef7';
              const count = parseInt(t.count);
              const maxCount = Math.max(...insightTypeDist.map(x => parseInt(x.count)), 1);
              return (
                <div key={t.insight_type}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 4, fontSize: 11,
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {INSIGHT_TYPE_ICONS[t.insight_type]} {INSIGHT_TYPE_LABELS[t.insight_type] || t.insight_type}
                    </span>
                    <span style={{ color, fontFamily: 'DM Mono', fontWeight: 500 }}>
                      {t.count} · {parseFloat(t.avg_lift).toFixed(1)}× avg lift
                    </span>
                  </div>
                  <div style={{
                    height: 5, background: 'var(--bg-elevated)',
                    borderRadius: 3, overflow: 'hidden',
                  }}>
                    <div className="bar-fill" style={{
                      height: '100%', borderRadius: 3,
                      background: color,
                      width: `${(count / maxCount) * 100}%`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Conditional rate heatmap ─────────────────────── */}
      <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
        <h3 className="font-display" style={{
          fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4,
        }}>
          Context-Conditional Conversion Rate Heatmap
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Each cell = conversion rate for a product under a specific context condition.
          Read across a row to see how one product's rate changes with context.
          Read down a column to compare products under the same context.
        </p>
        <ConditionalHeatmap heatmap={heatmap} />
      </div>

      {/* ── Most context-sensitive products ──────────────── */}
      {contextSensitiveProducts.length > 0 && (
        <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
          <h3 className="font-display" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4,
          }}>
            Most Context-Sensitive Products
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Products whose conversion rate varies most dramatically with context —
            highest intervention potential.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {contextSensitiveProducts.slice(0, 6).map((p, i) => {
              const hasCritical = p.severities?.includes('critical');
              return (
                <div key={p.product_id} style={{
                  padding: '14px 16px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 10,
                  border: `1px solid ${hasCritical ? 'rgba(244,63,94,0.2)' : 'var(--border)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>
                      {p.product_title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                      {p.insight_count} insights · max Δ {p.max_rate_diff}pp
                    </div>
                  </div>
                  <div style={{
                    fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono',
                    color: liftColor(parseFloat(p.max_lift)),
                  }}>
                    {parseFloat(p.max_lift).toFixed(1)}×
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Insight cards ────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 16,
        }}>
          <h3 className="font-display" style={{
            fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
          }}>
            All Context Insights
            <span style={{
              fontSize: 13, fontWeight: 400,
              color: 'var(--text-muted)', marginLeft: 8,
            }}>
              ({filteredInsights.length})
            </span>
          </h3>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={sevFilter}
              onChange={e => setSevFilter(e.target.value)}
              style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11,
                fontFamily: 'DM Mono', cursor: 'pointer',
                background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', outline: 'none',
              }}
            >
              <option value="all">All severity</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11,
                fontFamily: 'DM Mono', cursor: 'pointer',
                background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', outline: 'none',
              }}
            >
              <option value="all">All types</option>
              {Object.entries(INSIGHT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredInsights.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)', borderRadius: 12,
          }}>
            No insights match this filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredInsights.map((ins, i) => (
              <div key={ins.insight_id} style={{ animationDelay: `${i * 0.04}s` }}>
                <InsightCard
                  insight={ins}
                  expanded={expandedId === ins.insight_id}
                  onToggle={() => setExpandedId(
                    expandedId === ins.insight_id ? null : ins.insight_id
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
