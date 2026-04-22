'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Product } from 'lib/products';
import { WishlistButton } from './WishlistButton';
import { QuickView } from './QuickView';
import { trackRecentlyViewed } from './RecentlyViewed';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`h-3.5 w-3.5 ${i <= Math.round(rating) ? 'star-filled' : 'star-empty'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  return (
    <>
      <motion.div 
        whileHover={{ y: -8, scale: 1.01 }} 
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="product-card group relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all cursor-pointer"
      >
        {product.badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            {product.badge}
          </span>
        )}
        
        <div className="absolute right-3 top-3 z-10">
          <WishlistButton product={product} />
        </div>

        <Link 
          href={`/product/${product.id}`} 
          className="relative aspect-square overflow-hidden bg-stone-50 block"
          onClick={() => trackRecentlyViewed(product)}
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQuickViewOpen(true);
            }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-10 rounded-full bg-white/95 px-6 py-2.5 text-xs font-semibold text-stone-900 opacity-0 shadow-sm backdrop-blur transition-all hover:bg-stone-900 hover:text-white group-hover:translate-y-0 group-hover:opacity-100"
          >
            Quick View
          </button>
        </Link>
        <Link 
          href={`/product/${product.id}`} 
          className="flex flex-1 flex-col gap-1.5 p-4"
          onClick={() => trackRecentlyViewed(product)}
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
            {product.category}
          </span>
          <h3 className="text-sm font-medium leading-snug text-stone-800 line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-auto flex items-center gap-2 pt-2">
            <Stars rating={product.rating} />
            <span className="text-[11px] text-stone-400">({product.reviewCount})</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-base font-semibold text-stone-900">₹{product.price}</p>
            {product.originalPrice && (
              <p className="text-xs text-stone-400 line-through">₹{product.originalPrice}</p>
            )}
          </div>
        </Link>
      </motion.div>
      
      <QuickView product={product} isOpen={quickViewOpen} onClose={() => setQuickViewOpen(false)} />
    </>
  );
}
