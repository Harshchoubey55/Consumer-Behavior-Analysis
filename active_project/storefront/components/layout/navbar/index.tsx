'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tracker } from 'lib/tracking/tracker';
import { useCart } from 'components/cart/CartProvider';
import { useWishlist } from 'components/wishlist/WishlistProvider';
import { useAuth } from 'components/auth/AuthProvider';

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { user, isSignedIn } = useAuth();

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
    <nav className="sticky top-0 z-50 border-b border-white/20 bg-white/60 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all supports-[backdrop-filter]:bg-white/40">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-xl font-bold tracking-tighter text-stone-900 group">
            Zero<span className="text-stone-400 transition-colors group-hover:text-stone-900">Error</span>
          </span>
        </Link>

        {/* Center nav */}
        <div className="hidden items-center gap-6 sm:flex">
          <Link href="/search" className="text-sm text-stone-600 transition-colors hover:text-stone-900">
            Shop
          </Link>
          <Link href="/search?q=electronics" className="text-sm text-stone-600 transition-colors hover:text-stone-900">
            Electronics
          </Link>
          <Link href="/search?q=accessories" className="text-sm text-stone-600 transition-colors hover:text-stone-900">
            Accessories
          </Link>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="h-9 w-52 rounded-lg border border-stone-300 bg-stone-50 px-3 text-sm focus:border-stone-500 focus:outline-none"
                onBlur={() => !query && setSearchOpen(false)}
              />
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
              aria-label="Search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>
          )}

          <Link
            href="/wishlist"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            aria-label="Wishlist"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            {wishlistItems.length > 0 && (
              <span className="absolute right-2 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-stone-900 text-[9px] font-bold text-white">
                {wishlistItems.length}
              </span>
            )}
          </Link>

          {isSignedIn ? (
            <Link
              href="/signin"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700 transition-colors hover:bg-stone-200"
              aria-label="Account"
            >
              <span className="text-xs font-bold tracking-wider">{user?.name.charAt(0).toUpperCase()}</span>
            </Link>
          ) : (
            <Link
              href="/signin"
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
              aria-label="Sign In"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </Link>
          )}

          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            aria-label="Cart"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            {itemCount > 0 && (
              <span className="badge-pop absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-bold text-white">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
