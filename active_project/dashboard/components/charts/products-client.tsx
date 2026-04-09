'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { useState } from 'react';

const tooltipStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'DM Mono',
  color: 'var(--text-primary)',
};

type Product = {
  product_id: string;
  product_title: string;
  category: string;
  view_count: number;
  unique_viewers: number;
  cart_add_count: number;
  purchase_count: number;
  avg_price: string;
  view_to_cart_rate: string;
  cart_to_purchase_rate: string;
  last_viewed_at: string;
};

export default function ProductsClient({ data }: { data: { products: Product[]; searchTerms: any[]; categories: any[] } }) {
  const { products, searchTerms, categories } = data;
  const [sortBy, setSortBy] = useState<'views' | 'cart' | 'rate'>('views');

  const sorted = [...products].sort((a, b) => {
    if (sortBy === 'views') return b.view_count - a.view_count;
    if (sortBy === 'cart') return b.cart_add_count - a.cart_add_count;
    return parseFloat(b.view_to_cart_rate) - parseFloat(a.view_to_cart_rate);
  });

  return (
    <div>
      {/* Category breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>Views by Category</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={categories.map(c => ({ ...c, views: parseInt(c.views) }))} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="views" fill="#4f8ef7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card animate-in" style={{ padding: 24 }}>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Top Searches</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searchTerms.slice(0, 7).map((t, i) => (
              <div key={t.query} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono', width: 14 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.query}</span>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: '#4f8ef7' }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product table */}
      <div className="card animate-in" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Product Performance</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['views', 'cart', 'rate'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11,
                fontFamily: 'DM Mono', cursor: 'pointer',
                background: sortBy === s ? 'rgba(79,142,247,0.15)' : 'var(--bg-elevated)',
                color: sortBy === s ? '#4f8ef7' : 'var(--text-muted)',
                border: `1px solid ${sortBy === s ? 'rgba(79,142,247,0.3)' : 'var(--border)'}`,
              }}>
                {s === 'views' ? 'Views' : s === 'cart' ? 'Cart Adds' : 'V→C Rate'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Product', 'Category', 'Views', 'Unique', 'Cart Adds', 'Purchases', 'V→C Rate', 'C→P Rate', 'Price'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'DM Mono', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const vtcRate = parseFloat(p.view_to_cart_rate);
                const rateColor = vtcRate < 5 ? '#f43f5e' : vtcRate < 12 ? '#f59e0b' : '#22c55e';
                return (
                  <tr key={p.product_id} style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.product_title}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>{p.category}</td>
                    <td style={{ padding: '10px 12px', color: '#4f8ef7', fontFamily: 'DM Mono' }}>{p.view_count}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{p.unique_viewers}</td>
                    <td style={{ padding: '10px 12px', color: '#2dd4bf', fontFamily: 'DM Mono' }}>{p.cart_add_count}</td>
                    <td style={{ padding: '10px 12px', color: '#22c55e', fontFamily: 'DM Mono' }}>{p.purchase_count}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: rateColor, fontFamily: 'DM Mono', fontWeight: 500 }}>{vtcRate.toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'DM Mono' }}>{p.cart_to_purchase_rate}%</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>${p.avg_price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
