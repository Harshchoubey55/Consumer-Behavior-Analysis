import Link from 'next/link';
import Image from 'next/image';
import { PRODUCTS_LIST, CATEGORIES } from 'lib/products';
import { ProductCard } from 'components/ui/ProductCard';
import { RecentlyViewed } from 'components/ui/RecentlyViewed';
import { ScrollytellingHero } from 'components/ui/ScrollytellingHero';

export default function HomePage() {
  const featured = PRODUCTS_LIST.slice(0, 8);

  return (
    <div className="bg-white">
      {/* Cinematic Scrollytelling Engine */}
      <ScrollytellingHero />

      {/* Massive Gradient Blend to smooth the transition from the Black Hero into the White Grid */}
      <div className="w-full h-[500px] bg-gradient-to-b from-black to-white" />

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">Featured</h2>
          <Link href="/search" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 md:gap-5">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <RecentlyViewed />

      {/* Value props */}
      <section className="border-t border-stone-200 bg-white mt-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:grid-cols-3 md:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-900">Free Shipping</p>
            <p className="mt-1 text-xs text-stone-500">On orders over ₹4000</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-900">30-Day Returns</p>
            <p className="mt-1 text-xs text-stone-500">No questions asked</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-900">2-Year Warranty</p>
            <p className="mt-1 text-xs text-stone-500">On every product</p>
          </div>
        </div>
      </section>
    </div>
  );
}
