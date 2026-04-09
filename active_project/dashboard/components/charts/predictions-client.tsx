'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';

const tooltipStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'DM Mono',
  color: 'var(--text-primary)',
};

export default function PredictionsClient({ data }: { data: any }) {
  const { churnBuckets, churnHistogram, engagementDist, highValueUsers, atRiskUsers, rfmData } = data;

  const rfmScatter = (rfmData || []).map((u: any) => ({
    x: parseInt(u.recency_score),
    y: parseInt(u.frequency_score),
    z: parseInt(u.engagement_score),
    risk: u.churn_risk,
  }));

  const riskColors: Record<string, string> = { high: '#f43f5e', medium: '#f59e0b', low: '#22c55e' };

  return (
    <div>
      {/* Churn + Engagement top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Churn histogram */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Churn Probability Distribution</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>Users bucketed by estimated churn probability</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(churnHistogram || []).map((c: any) => ({ bucket: c.bucket, count: parseInt(c.count) }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {(churnHistogram || []).map((_: any, i: number) => {
                  const colors = ['#22c55e','#22c55e','#2dd4bf','#4f8ef7','#f59e0b','#f59e0b','#f43f5e','#f43f5e','#f43f5e','#dc2626'];
                  return <Cell key={i} fill={colors[i] || '#4f8ef7'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement tiers */}
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Engagement Score Distribution</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>User segmentation by behavioral engagement score</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            {(engagementDist || []).map((e: any) => {
              const total = engagementDist.reduce((s: number, x: any) => s + parseInt(x.count), 0);
              const pct = total > 0 ? (parseInt(e.count) / total) * 100 : 0;
              const color = e.tier === 'high' ? '#22c55e' : e.tier === 'medium' ? '#f59e0b' : '#4d566f';
              return (
                <div key={e.tier}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{e.tier} Engagement</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'DM Mono' }}>avg score: {e.avg_score}%</span>
                    </div>
                    <span style={{ color, fontFamily: 'DM Mono', fontSize: 12 }}>{e.count} users · {pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                    <div className="bar-fill" style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RFM Scatter */}
      <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
        <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>RFM User Map — Recency vs Frequency</h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>Each dot is a user. Color = churn risk. Size = engagement score.</p>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="x" type="number" name="Recency" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} label={{ value: 'Recency Score →', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} />
            <YAxis dataKey="y" type="number" name="Frequency" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} label={{ value: 'Frequency →', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} />
            <ZAxis dataKey="z" range={[20, 120]} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: 'var(--border)' }} />
            {['high', 'medium', 'low'].map(risk => (
              <Scatter
                key={risk}
                name={`${risk} risk`}
                data={rfmScatter.filter((u: any) => u.risk === risk)}
                fill={riskColors[risk]}
                fillOpacity={0.7}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
          {Object.entries(riskColors).map(([risk, color]) => (
            <div key={risk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono', textTransform: 'capitalize' }}>{risk} risk</span>
            </div>
          ))}
        </div>
      </div>

      {/* At-risk users */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>⚠ At-Risk Users</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>High churn probability, previously active</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(atRiskUsers || []).slice(0, 6).map((u: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{u.user_id.substring(0, 16)}…</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{u.days_since_last} days inactive · {u.session_count} sessions</div>
                </div>
                <div style={{ fontSize: 13, color: '#f43f5e', fontFamily: 'DM Mono', fontWeight: 500 }}>{u.churn_probability}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>★ High-Value Users</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>High engagement, low churn risk</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(highValueUsers || []).slice(0, 6).map((u: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{u.user_id.substring(0, 16)}…</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{u.session_count} sessions · {u.total_purchases} purchases</div>
                </div>
                <div style={{ fontSize: 13, color: '#22c55e', fontFamily: 'DM Mono', fontWeight: 500 }}>{u.engagement_score}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
