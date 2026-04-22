'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWishlist } from 'components/wishlist/WishlistProvider';
import { useCart } from 'components/cart/CartProvider';
import { useToast } from 'components/ui/Toast';
import { tracker } from 'lib/tracking/tracker';

export default function WishlistPage() {
  const { items, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const handleAddAndRemove = (product: any) => {
    addToCart(product, 1);
    tracker.addToCart({ id: product.id, price: product.price, quantity: 1 });
    showToast('Added to cart', product.image, product.name);
    removeFromWishlist(product.id);
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-4 py-16">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">Your wishlist is empty</h1>
        <p className="mt-2 text-stone-500">Save items you like to review them later.</p>
        <Link href="/search" className="btn-press mt-8 rounded-full bg-stone-900 px-8 py-3 text-sm font-semibold text-white hover:bg-stone-800">
          Explore Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-stone-900 mb-8">Wishlist <span className="text-stone-400 text-lg font-medium ml-2">({items.length})</span></h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((product) => (
          <div key={product.id} className="group flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden animate-fade-in hover:shadow-md transition-shadow">
            <Link href={`/product/${product.id}`} className="relative aspect-[4/3] block bg-stone-100 overflow-hidden">
               <Image 
                 src={product.image} 
                 alt={product.name}
                 fill
                 className="object-cover transition-transform duration-500 group-hover:scale-105"
                 sizes="(max-width: 768px) 100vw, 25vw"
               />
            </Link>
            <div className="p-5 flex flex-col flex-1">
               <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{product.category}</p>
               <Link href={`/product/${product.id}`}>
                 <h3 className="mt-1 font-semibold text-stone-900 hover:underline">{product.name}</h3>
               </Link>
               <p className="mt-1 text-sm font-bold text-stone-900">₹{product.price}</p>
               
               <div className="mt-auto pt-5 flex items-center gap-3">
                 <button 
                   onClick={() => handleAddAndRemove(product)}
                   className="btn-press flex-1 rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 transition-colors"
                 >
                   Move to Cart
                 </button>
                 <button 
                   onClick={() => removeFromWishlist(product.id)}
                   className="rounded-xl border border-stone-200 p-2.5 text-stone-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                   aria-label="Remove"
                 >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                 </button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
