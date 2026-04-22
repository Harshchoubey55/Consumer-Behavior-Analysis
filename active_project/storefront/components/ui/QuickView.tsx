'use client';

import React from 'react';
import Image from 'next/image';
import { Product } from 'lib/products';
import { useCart } from 'components/cart/CartProvider';
import { useToast } from './Toast';
import { tracker } from 'lib/tracking/tracker';
import Link from 'next/link';
import { WishlistButton } from './WishlistButton';

export function QuickView({ product, isOpen, onClose }: { product: Product, isOpen: boolean, onClose: () => void }) {
  const { addToCart } = useCart();
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleAddToCart = () => {
    addToCart(product, 1);
    tracker.addToCart({ id: product.id, price: product.price, quantity: 1 });
    showToast('Added to cart', product.image, product.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="relative aspect-square w-full bg-stone-100 md:w-1/2">
          <Image src={product.image} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
          <div className="absolute top-4 left-4">
             <WishlistButton product={product} />
          </div>
        </div>
        
        <div className="flex w-full flex-col p-8 md:w-1/2 justify-center">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-500">{product.category}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">{product.name}</h2>
          
          <div className="mt-4 flex items-center gap-4">
            <span className="text-2xl font-semibold text-stone-900">₹{product.price}</span>
            {product.originalPrice && (
              <span className="text-lg text-stone-400 line-through">₹{product.originalPrice}</span>
            )}
          </div>
          
          <p className="mt-6 text-sm leading-relaxed text-stone-600 line-clamp-3">{product.description}</p>
          
          <div className="mt-8 flex gap-3">
            <button
              onClick={handleAddToCart}
              className="btn-press flex-1 rounded-xl bg-stone-900 py-4 font-semibold text-white transition-colors hover:bg-stone-800"
            >
              Add to Cart
            </button>
            <Link 
              href={`/product/${product.id}`}
              className="flex items-center justify-center rounded-xl border border-stone-200 px-6 font-medium text-stone-900 hover:bg-stone-50"
            >
              Full Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
