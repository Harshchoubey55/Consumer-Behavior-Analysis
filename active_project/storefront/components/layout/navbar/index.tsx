'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tracker } from 'lib/tracking/tracker';

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      tracker.search(query.trim());
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery('');
    }
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="hidden sm:block text-sm">Analytics Store</span>
        </Link>

        <div className="flex items-center gap-2">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="h-9 w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:border-indigo-400"
                onBlur={() => !query && setSearchOpen(false)}
              />
            </form>
          ) : (
            <button onClick={() => setSearchOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}

          <Link href="/search" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">
            Products
          </Link>

          <Link href="/dashboard" className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </Link>
        </div>
      </div>
    </nav>
  );
}
