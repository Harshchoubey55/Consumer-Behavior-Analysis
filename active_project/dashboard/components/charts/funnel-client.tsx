'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type FunnelStep = {
  step_name: string;
  step_order: number;
  session_count: number;
  user_count: number;
  dropoff_rate: number;
  retention_rate: number;
};

const STEP_LABELS: Record<string, string> = {
  home: 'Homepage',
  product_listing: 'Product List',
  product_detail: 'Product Detail',
  add_to_cart: 'Add to Cart',
  checkout_start: 'Checkout',
  purchase: 'Purchase',
};

const tooltipStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'DM Mono',
  color: 'var(--text-primary)',
};

export default function FunnelClient({ data }: { data: { funnel: FunnelStep[]; checkoutSteps: any[] } }) {
  const { funnel, checkoutSteps } = data;
  const maxUsers = funnel[0]?.user_count || 1;

  return (
    <div>
      {/* Visual funnel bars */}
      <div className="card animate-in" style={{ padding: '28px 28px 24px', marginBottom: 24 }}>
        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>
          Full Conversion Funnel
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {funnel.map((step, i) => {
            const pct = (step.user_count / maxUsers) * 100;
            const isDropoff = step.dropoff_rate > 40;
            const color = i === 0 ? '#4f8ef7' : isDropoff ? '#f43f5e' : '#2dd4bf';

            return (
              <div key={step.step_name} className="animate-in" style={{ animationDelay: `${i * 0.08}s` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Step label */}
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>
                      {STEP_LABELS[step.step_name] || step.step_name}
                    </div>
                  </div>

                  {/* Bar */}
                  <div style={{ flex: 1, height: 36, background: 'var(--bg-elevated)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div
                      className="bar-fill"
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}cc, ${color}55)`,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 12,
                        minWidth: 60,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    >
                      <span style={{ fontSize: 12, fontFamily: 'DM Mono', color, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {step.user_count.toLocaleString()} users
                      </span>
                    </div>
                  </div>

                  {/* Dropoff badge */}
                  <div style={{ width: 120, textAlign: 'right', flexShrink: 0 }}>
                    {i > 0 ? (
                      <div style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontFamily: 'DM Mono',
                        background: isDropoff ? 'rgba(244,63,94,0.12)' : 'rgba(45,212,191,0.1)',
                        color: isDropoff ? '#f43f5e' : '#2dd4bf',
                        border: `1px solid ${isDropoff ? 'rgba(244,63,94,0.25)' : 'rgba(45,212,191,0.2)'}`,
                      }}>
                        ↓ {step.dropoff_rate}%
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>ENTRY</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {funnel.slice(1).map((step, i) => (
          <div key={step.step_name} className="card animate-in" style={{ padding: 20, animationDelay: `${i * 0.06}s` }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'DM Mono' }}>
              {STEP_LABELS[step.step_name]?.toUpperCase() || step.step_name.toUpperCase()}
            </div>
            <div className="font-display" style={{
              fontSize: 28,
              fontWeight: 700,
              color: step.dropoff_rate > 40 ? '#f43f5e' : '#2dd4bf',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              {step.retention_rate}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              retention from prev step
            </div>
          </div>
        ))}
      </div>

      {/* Checkout step analysis */}
      {checkoutSteps.length > 0 && (
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Checkout Step Analysis
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={checkoutSteps} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="users" radius={[6, 6, 0, 0]}>
                {checkoutSteps.map((_, i) => (
                  <Cell key={i} fill={['#4f8ef7', '#2dd4bf', '#f59e0b', '#22c55e'][i] || '#4f8ef7'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
