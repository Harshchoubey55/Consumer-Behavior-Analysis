'use client';

import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'DM Mono',
  color: 'var(--text-primary)',
};

// State position layout for the Markov graph (fixed positions)
const STATE_POSITIONS: Record<string, { x: number; y: number; color: string }> = {
  'HOME':         { x: 80,  y: 200, color: '#4f8ef7' },
  'SEARCH':       { x: 200, y: 80,  color: '#8b5cf6' },
  'BROWSE':       { x: 280, y: 200, color: '#2dd4bf' },
  'VIEW_PRODUCT': { x: 460, y: 200, color: '#f59e0b' },
  'ADD_CART':     { x: 620, y: 140, color: '#22c55e' },
  'REMOVE_CART':  { x: 620, y: 270, color: '#f43f5e' },
  'VIEW_CART':    { x: 740, y: 200, color: '#22c55e' },
  'CHECKOUT':     { x: 880, y: 200, color: '#4f8ef7' },
  'PURCHASE':     { x: 1000,y: 200, color: '#22c55e' },
};

function MarkovGraph({ transitions, nodes }: { transitions: any[]; nodes: any[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const width = 1100;
  const height = 380;
  const nodeR = 38;

  // Only show top transitions to avoid visual clutter
  const topTransitions = transitions
    .filter(t => STATE_POSITIONS[t.from_state] && STATE_POSITIONS[t.to_state])
    .sort((a, b) => b.transition_count - a.transition_count)
    .slice(0, 18);

  const maxCount = Math.max(...topTransitions.map(t => t.transition_count), 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 700, height: 'auto', display: 'block' }}
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.25)" />
          </marker>
          <marker id="arrow-conv" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#22c55e" />
          </marker>
          {Object.entries(STATE_POSITIONS).map(([state, pos]) => (
            <radialGradient key={state} id={`grad-${state}`} cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor={pos.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={pos.color} stopOpacity={0.08} />
            </radialGradient>
          ))}
        </defs>

        {/* Edges */}
        {topTransitions.map((t, i) => {
          const from = STATE_POSITIONS[t.from_state];
          const to = STATE_POSITIONS[t.to_state];
          if (!from || !to || t.from_state === t.to_state) return null;

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) return null;

          const nx = dx / dist;
          const ny = dy / dist;

          const x1 = from.x + nx * nodeR;
          const y1 = from.y + ny * nodeR;
          const x2 = to.x - nx * (nodeR + 6);
          const y2 = to.y - ny * (nodeR + 6);

          // Slight curve for parallel edges
          const midX = (x1 + x2) / 2 + ny * 25;
          const midY = (y1 + y2) / 2 - nx * 25;

          const prob = parseFloat(t.transition_prob);
          const isHighConv = parseFloat(t.conversion_rate) > 20;
          const opacity = 0.15 + (t.transition_count / maxCount) * 0.65;
          const strokeW = 0.5 + (t.transition_count / maxCount) * 3;
          const isHovered = hovered === `${t.from_state}-${t.to_state}`;

          return (
            <g key={i}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(`${t.from_state}-${t.to_state}`)}
              onMouseLeave={() => setHovered(null)}
            >
              <path
                d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                fill="none"
                stroke={isHighConv ? '#22c55e' : 'rgba(255,255,255,0.5)'}
                strokeWidth={isHovered ? strokeW + 1.5 : strokeW}
                strokeOpacity={isHovered ? 0.9 : opacity}
                markerEnd={isHighConv ? 'url(#arrow-conv)' : 'url(#arrow)'}
              />
              {isHovered && (
                <text
                  x={midX}
                  y={midY - 8}
                  textAnchor="middle"
                  fill="white"
                  fontSize={10}
                  fontFamily="DM Mono"
                  style={{ pointerEvents: 'none' }}
                >
                  {prob}% · conv {t.conversion_rate}%
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {Object.entries(STATE_POSITIONS).map(([state, pos]) => {
          const isHoveredNode = hovered?.includes(state);
          return (
            <g key={state} transform={`translate(${pos.x}, ${pos.y})`}>
              <circle
                r={nodeR}
                fill={`url(#grad-${state})`}
                stroke={isHoveredNode ? pos.color : `${pos.color}55`}
                strokeWidth={isHoveredNode ? 2 : 1}
                style={{ transition: 'all 0.2s' }}
              />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontFamily="DM Mono"
                fill={pos.color}
                fontWeight="500"
              >
                {state.replace('_', '\n')}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono', textAlign: 'center' }}>
        Hover edges for transition probability and conversion lift · Edge thickness = frequency · Green edges = high conversion lift
      </div>
    </div>
  );
}

export default function PathsClient({ data }: { data: any }) {
  const { transitions, nodes, paths, abandonmentStates, riskDist, seqLengths } = data;

  const riskColors: Record<string, string> = {
    critical: '#f43f5e', high: '#f59e0b', medium: '#4f8ef7', low: '#22c55e',
  };

  const seqData = (seqLengths || []).map((s: any) => ({
    length: parseInt(s.length),
    sessions: parseInt(s.sessions),
    conv_rate: parseFloat(s.conv_rate),
  }));

  return (
    <div>
      {/* Markov Graph */}
      <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            Session State Transition Graph
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            First-order Markov chain fitted to {transitions?.length || 0} observed transitions.
            Arrow weight = transition frequency. Edge color intensity = conversion lift.
          </p>
        </div>
        <MarkovGraph transitions={transitions || []} nodes={nodes || []} />
      </div>

      {/* Top transitions table + Abandonment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Top transitions */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Highest-Frequency Transitions
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['From', 'To', 'Count', 'P(%)', 'Conv%'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'DM Mono', fontWeight: 400, fontSize: 10, letterSpacing: '0.06em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(transitions || []).slice(0, 12).map((t: any, i: number) => {
                  const convRate = parseFloat(t.conversion_rate);
                  const convColor = convRate > 30 ? '#22c55e' : convRate > 10 ? '#f59e0b' : 'var(--text-muted)';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 8px', color: '#4f8ef7', fontFamily: 'DM Mono' }}>{t.from_state}</td>
                      <td style={{ padding: '8px 8px', color: '#2dd4bf', fontFamily: 'DM Mono' }}>{t.to_state}</td>
                      <td style={{ padding: '8px 8px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{t.transition_count}</td>
                      <td style={{ padding: '8px 8px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{t.transition_prob}%</td>
                      <td style={{ padding: '8px 8px', color: convColor, fontFamily: 'DM Mono', fontWeight: 500 }}>{t.conversion_rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Abandonment heatmap */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Abandonment by State</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Where non-converting sessions last appear</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(abandonmentStates || []).map((s: any) => ({
              state: s.abandoned_at?.replace('_', ' '),
              count: parseInt(s.count),
              pct: parseFloat(s.pct),
            }))} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="state" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#f43f5e" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sequence length vs conversion + Common paths */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20, marginBottom: 20 }}>

        {/* Sequence length analysis */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Sequence Length vs Conversion
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Longer sessions tend to convert more — until disengagement sets in
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={seqData} margin={{ top: 4, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="length" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} label={{ value: 'Events in session', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text-muted)' }} />
              <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#4f8ef7" strokeWidth={2} dot={false} name="Sessions" />
              <Line yAxisId="right" type="monotone" dataKey="conv_rate" stroke="#22c55e" strokeWidth={2} dot={false} name="Conv%" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Common paths */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Most Common Session Paths
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {(paths || []).slice(0, 10).map((p: any, i: number) => {
              const convRate = parseFloat(p.conversion_rate);
              const convColor = convRate > 30 ? '#22c55e' : convRate > 5 ? '#f59e0b' : '#f43f5e';
              return (
                <div key={i} style={{
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                      {p.session_count} sessions
                    </span>
                    <span style={{ fontSize: 11, color: convColor, fontFamily: 'DM Mono', fontWeight: 500 }}>
                      {p.conversion_rate}% converted
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono', lineHeight: 1.5 }}>
                    {(p.path_array || p.path_signature.split('>')).map((step: string, si: number) => (
                      <span key={si}>
                        {si > 0 && <span style={{ color: 'var(--text-muted)', margin: '0 3px' }}>›</span>}
                        <span style={{ color: si === (p.path_array?.length || 0) - 1 ? '#4f8ef7' : 'var(--text-secondary)' }}>
                          {step.replace('_', ' ')}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Risk distribution */}
      <div className="card animate-in" style={{ padding: 24 }}>
        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          In-Session Risk Score Distribution
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Risk scores computed by the Markov-based scorer during sessions.
          Scores reflect P(abandonment) given the sequence seen so far — not aggregate counts.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {(riskDist || []).map((r: any) => {
            const color = riskColors[r.tier] || '#4f8ef7';
            return (
              <div key={r.tier} style={{
                padding: '16px 20px',
                background: 'var(--bg-elevated)',
                borderRadius: 10,
                border: `1px solid ${color}33`,
              }}>
                <div style={{ fontSize: 10, color, fontFamily: 'DM Mono', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                  {r.tier} risk
                </div>
                <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
                  {r.count}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  avg score: {r.avg_risk}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
