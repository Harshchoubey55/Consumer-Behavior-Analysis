'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product, getProductsByCategory } from 'lib/products';

const STORAGE_KEY = '_ze_recent';

// Helper to push to recently viewed
export function trackRecentlyViewed(product: Product) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    let items: Product[] = raw ? JSON.parse(raw) : [];
    items = items.filter(p => p.id !== product.id);
    items.unshift(product);
    if (items.length > 6) items = items.slice(0, 6);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function RecentlyViewed() {
  const [recent, setRecent] = useState<Product[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  if (recent.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6 border-t border-stone-200 mt-16">
      <h2 className="mb-8 text-2xl font-bold tracking-tight text-stone-900">Recently Viewed</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {recent.map((product) => (
          <Link key={product.id} href={`/product/${product.id}`} className="group relative w-48 shrink-0 flex-col overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200 transition-all hover:shadow-md">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              <Image src={product.image} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 768px) 50vw, 20vw" />
            </div>
            <div className="mt-3">
              <h3 className="truncate text-sm font-medium text-stone-800">{product.name}</h3>
              <p className="mt-1 text-sm font-semibold text-stone-900">₹{product.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
