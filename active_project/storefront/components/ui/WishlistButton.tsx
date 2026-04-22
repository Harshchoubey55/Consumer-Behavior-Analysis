'use client';

import React from 'react';
import { useWishlist } from '../wishlist/WishlistProvider';
import { Product } from 'lib/products';
import { useToast } from './Toast';

export function WishlistButton({ product, className = '' }: { product: Product; className?: string }) {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { showToast } = useToast();
  const active = isInWishlist(product.id);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (active) {
      removeFromWishlist(product.id);
      showToast('Removed from wishlist');
    } else {
      addToWishlist(product);
      showToast('Added to wishlist', product.image, product.name);
    }
  };

  return (
    <button
      onClick={toggle}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-all hover:bg-white hover:scale-110 ${active ? 'text-red-500' : 'text-stone-400 hover:text-red-400'} ${className}`}
      aria-label="Toggle wishlist"
    >
      <svg className="h-5 w-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    </button>
  );
}
