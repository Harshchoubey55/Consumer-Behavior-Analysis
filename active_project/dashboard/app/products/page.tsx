import ProductsClient from '../../components/charts/products-client';
export const metadata = { title: 'Products' };
export const revalidate = 60;
const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/products`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('');
    return res.json();
  } catch { return null; }
}

export default async function ProductsPage() {
  const data = await getData();
  return (
    <div style={{ padding: '32px 32px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>Products</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Product-level engagement metrics, view-to-cart rates, and search intent signals.</p>
      </div>
      {data ? <ProductsClient data={data} /> : <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>No product data available.</div>}
    </div>
  );
}
