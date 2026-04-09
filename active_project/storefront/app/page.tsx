import Link from 'next/link';

const DEMO_PRODUCTS = [
  { id: 'prod_001', name: 'Wireless Noise-Cancelling Headphones', price: 149, category: 'Electronics', badge: 'Best Seller' },
  { id: 'prod_002', name: 'Ergonomic Office Chair', price: 349, category: 'Furniture', badge: null },
  { id: 'prod_003', name: 'Running Shoes Pro X', price: 89, category: 'Footwear', badge: 'New' },
  { id: 'prod_004', name: 'Stainless Steel Water Bottle', price: 29, category: 'Accessories', badge: null },
  { id: 'prod_005', name: 'Smart Home Hub', price: 99, category: 'Electronics', badge: 'Popular' },
  { id: 'prod_006', name: 'Yoga Mat Premium', price: 45, category: 'Fitness', badge: null },
  { id: 'prod_007', name: 'Leather Wallet Slim', price: 59, category: 'Accessories', badge: null },
  { id: 'prod_008', name: 'Mechanical Keyboard TKL', price: 129, category: 'Electronics', badge: null },
];

const CATEGORIES = [
  { id: 'electronics', name: 'Electronics', icon: '💻', count: 3 },
  { id: 'furniture', name: 'Furniture', icon: '🪑', count: 1 },
  { id: 'footwear', name: 'Footwear', icon: '👟', count: 1 },
  { id: 'accessories', name: 'Accessories', icon: '👜', count: 3 },
  { id: 'fitness', name: 'Fitness', icon: '🏃', count: 1 },
  { id: 'kitchen', name: 'Kitchen', icon: '☕', count: 1 },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <div className="max-w-2xl">
            <span className="mb-4 inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-300">
              Analytics Demo Store
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Every Click<br />
              <span className="text-indigo-400">Tells a Story</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-slate-300">
              This storefront is instrumented with a real-time behavioral analytics system.
              Every interaction you make is captured, processed, and surfaced in the analytics dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/search" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Browse Products
              </Link>
              <Link href="/dashboard" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
                View Analytics Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <h2 className="mb-6 text-xl font-bold text-slate-800">Shop by Category</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/search/${cat.id}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-center transition-all hover:border-indigo-300 hover:shadow-sm"
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-xs font-medium text-slate-700">{cat.name}</span>
              <span className="text-xs text-slate-400">{cat.count} items</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-xl font-bold text-slate-800">Featured Products</h2>
          <Link href="/search" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 md:gap-6">
          {DEMO_PRODUCTS.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:border-indigo-200 hover:shadow-md"
            >
              {product.badge && (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {product.badge}
                </span>
              )}
              <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                <span className="text-5xl opacity-30">📦</span>
              </div>
              <div className="flex flex-col gap-1 p-4">
                <span className="text-xs text-indigo-500 font-medium">{product.category}</span>
                <h3 className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2">{product.name}</h3>
                <p className="mt-1 text-base font-bold text-slate-900">${product.price}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Analytics CTA */}
      <section className="border-t border-slate-100 bg-indigo-50">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center md:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Built-in Analytics</p>
          <h2 className="mt-3 text-2xl font-bold text-slate-800 md:text-3xl">
            Every interaction is being tracked
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-500">
            Page views, product clicks, cart additions, and checkout steps are captured in real time and
            processed into behavioral insights available in the internal analytics dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open Analytics Dashboard
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
