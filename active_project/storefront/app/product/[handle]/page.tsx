'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { tracker, registerMicroHesitation } from 'lib/tracking/tracker';
import { useIntervention } from '../../../components/tracking/InterventionProvider';
import { useCart } from 'components/cart/CartProvider';
import { PRODUCTS, getRelatedProducts } from 'lib/products';
import type { Product } from 'lib/products';
import { ProductCard } from 'components/ui/ProductCard';
import { RecentlyViewed, trackRecentlyViewed } from 'components/ui/RecentlyViewed';
import { WishlistButton } from 'components/ui/WishlistButton';

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`${cls} ${i <= Math.round(rating) ? 'star-filled' : 'star-empty'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export default function ProductPage() {
  const params = useParams();
  const handle = params?.handle as string;
  const product = PRODUCTS[handle];
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [hoverStartTime, setHoverStartTime] = useState<number | null>(null);
  const { addItem } = useCart();
  const { setCurrentProduct } = useIntervention();
  const related = product ? getRelatedProducts(product.id) : [];

  useEffect(() => {
    if (product) {
      setCurrentProduct({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        features: product.features,
      });

      tracker.productView({
        id: product.id,
        title: product.name,
        price: product.price,
        category: product.category,
      });
      trackRecentlyViewed(product);
    }
    return () => setCurrentProduct(null);
  }, [handle, product, setCurrentProduct]);

  if (!product) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-stone-500">Product not found</p>
        <Link href="/search" className="text-sm text-stone-700 underline underline-offset-4">
          Browse all products
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    tracker.addToCart({
      id: product.id,
      title: product.name,
      price: product.price,
      quantity: quantity,
      category: product.category,
    });
    addItem(
      { id: product.id, name: product.name, price: product.price, image: product.image, category: product.category },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleMouseEnter = () => setHoverStartTime(Date.now());
  const handleMouseLeave = () => {
    if (hoverStartTime && Date.now() - hoverStartTime > 1000) {
      registerMicroHesitation();
    }
    setHoverStartTime(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-stone-400">
        <Link href="/" className="transition-colors hover:text-stone-700">Home</Link>
        <span>/</span>
        <Link href="/search" className="transition-colors hover:text-stone-700">Products</Link>
        <span>/</span>
        <span className="text-stone-600">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
        {/* Product image */}
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          {product.badge && (
            <span className="absolute left-4 top-4 rounded-full bg-stone-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white">
              {product.badge}
            </span>
          )}
          <div className="absolute right-4 top-4">
             <WishlistButton product={product} />
          </div>
        </div>

        {/* Product info */}
        <div className="flex flex-col gap-5">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400">
              {product.category}
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 md:text-3xl">
              {product.name}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <Stars rating={product.rating} size="md" />
              <span className="text-sm text-stone-500">{product.rating} ({product.reviewCount} reviews)</span>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <p className="text-2xl font-semibold text-stone-900">₹{product.price}</p>
              {product.originalPrice && (
                <p className="text-base text-stone-400 line-through">₹{product.originalPrice}</p>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-stone-600">{product.description}</p>

          <ul className="space-y-2.5">
            {product.features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-stone-700">
                <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {/* Quantity */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-stone-700">Quantity</span>
            <div className="flex items-center rounded-lg border border-stone-200">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3.5 py-2 text-stone-500 transition-colors hover:text-stone-900"
              >
                −
              </button>
              <span className="min-w-[36px] text-center text-sm font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3.5 py-2 text-stone-500 transition-colors hover:text-stone-900"
              >
                +
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={`btn-press flex-1 rounded-xl py-4 text-sm font-semibold transition-all ${
                added
                  ? 'bg-green-700 text-white'
                  : 'bg-stone-900 text-white hover:bg-stone-800'
              }`}
            >
              {added ? '✓ Added to Cart' : 'Add to Cart'}
            </button>
            <Link
              href="/cart"
              onClick={handleAddToCart}
              className="btn-press rounded-xl border border-stone-300 px-6 py-4 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-500 hover:bg-stone-50"
            >
              Buy Now
            </Link>
          </div>

          {/* Shipping info */}
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            Free shipping on orders over ₹4000 · 30-day returns
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-lg font-semibold tracking-tight text-stone-900">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-5">
            {related.map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </section>
      )}
      
      <RecentlyViewed />
    </div>
  );
}
