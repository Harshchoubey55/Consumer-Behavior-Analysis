'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { tracker } from 'lib/tracking/tracker';

const ALL_PRODUCTS = [
  { id: 'prod_001', name: 'Wireless Noise-Cancelling Headphones', price: 149, category: 'electronics' },
  { id: 'prod_002', name: 'Ergonomic Office Chair', price: 349, category: 'furniture' },
  { id: 'prod_003', name: 'Running Shoes Pro X', price: 89, category: 'footwear' },
  { id: 'prod_004', name: 'Stainless Steel Water Bottle', price: 29, category: 'accessories' },
  { id: 'prod_005', name: 'Smart Home Hub', price: 99, category: 'electronics' },
  { id: 'prod_006', name: 'Yoga Mat Premium', price: 45, category: 'fitness' },
  { id: 'prod_007', name: 'Leather Wallet Slim', price: 59, category: 'accessories' },
  { id: 'prod_008', name: 'Mechanical Keyboard TKL', price: 129, category: 'electronics' },
  { id: 'prod_009', name: 'Coffee Maker Deluxe', price: 79, category: 'kitchen' },
  { id: 'prod_010', name: 'Sunglasses UV400', price: 39, category: 'accessories' },
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  useEffect(() => {
    if (query) {
      tracker.search(query);
    }
  }, [query]);

  const filtered = query
    ? ALL_PRODUCTS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.includes(query.toLowerCase()))
    : ALL_PRODUCTS;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          {query ? `Results for "${query}"` : 'All Products'}
        </h1>
        <span className="text-sm text-slate-400">{filtered.length} products</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 md:gap-6">
        {filtered.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
              <span className="text-4xl opacity-30">📦</span>
            </div>
            <div className="p-4">
              <span className="text-xs font-medium text-indigo-500 capitalize">{product.category}</span>
              <h3 className="mt-1 text-sm font-semibold text-slate-800 line-clamp-2">{product.name}</h3>
              <p className="mt-2 font-bold text-slate-900">${product.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
