'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { tracker } from 'lib/tracking/tracker';
import { PRODUCTS_LIST, CATEGORIES } from 'lib/products';
import { ProductCard } from 'components/ui/ProductCard';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'star-filled' : 'star-empty'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

type SortMode = 'relevance' | 'price-asc' | 'price-desc' | 'rating';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const [sort, setSort] = useState<SortMode>('relevance');
  const [selectedCat, setSelectedCat] = useState<string>('');

  useEffect(() => {
    // Direct category param takes priority (from Explore Series links)
    if (categoryParam) {
      const catMatch = CATEGORIES.find((c) => c.slug === categoryParam.toLowerCase());
      if (catMatch) setSelectedCat(catMatch.slug);
      else setSelectedCat('');
    } else if (query) {
      tracker.search(query);
      // If query matches a category slug exactly, filter by it
      const catMatch = CATEGORIES.find((c) => c.slug === query.toLowerCase());
      if (catMatch) setSelectedCat(catMatch.slug);
      else setSelectedCat('');
    } else {
      setSelectedCat('');
    }
  }, [query, categoryParam]);

  const filtered = useMemo(() => {
    let results = PRODUCTS_LIST;

    if (selectedCat) {
      results = results.filter((p) => p.categorySlug === selectedCat);
    } else if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.categorySlug.includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case 'price-asc':
        return [...results].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...results].sort((a, b) => b.price - a.price);
      case 'rating':
        return [...results].sort((a, b) => b.rating - a.rating);
      default:
        return results;
    }
  }, [query, sort, selectedCat]);

  const handleCategoryClick = (slug: string) => {
    tracker.categoryClick(slug);
    setSelectedCat(slug === selectedCat ? '' : slug);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {selectedCat
            ? CATEGORIES.find((c) => c.slug === selectedCat)?.name || 'Products'
            : query
              ? `Results for "${query}"`
              : 'All Products'}
        </h1>
        <p className="mt-1 text-sm text-stone-500">{filtered.length} products</p>
      </div>

      {/* Filters bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedCat(''); }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              !selectedCat ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryClick(cat.slug)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedCat === cat.slug ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="ml-auto rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 focus:outline-none"
        >
          <option value="relevance">Sort: Relevance</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="text-stone-400">No products found.</p>
          <Link href="/search" className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900">
            Browse all products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 md:gap-5">
          {filtered.map((product, idx) => (
            <div key={product.id} onClick={() => tracker.categoryClick(product.categorySlug)}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-center text-stone-400">Loading products...</div>}>
      <SearchContent />
    </Suspense>
  );
}
