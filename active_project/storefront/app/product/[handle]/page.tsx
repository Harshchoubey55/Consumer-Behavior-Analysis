'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { tracker, registerMicroHesitation } from 'lib/tracking/tracker';

const PRODUCTS: Record<string, { id: string; name: string; price: number; category: string; description: string; features: string[] }> = {
  prod_001: { id: 'prod_001', name: 'Wireless Noise-Cancelling Headphones', price: 149, category: 'Electronics', description: 'Premium audio experience with industry-leading noise cancellation. Up to 30 hours battery life, foldable design, and plush ear cushions for all-day comfort.', features: ['Active Noise Cancellation', '30hr Battery Life', 'USB-C Charging', 'Multipoint Connection', 'Foldable Design'] },
  prod_002: { id: 'prod_002', name: 'Ergonomic Office Chair', price: 349, category: 'Furniture', description: 'Fully adjustable ergonomic chair designed for long work sessions. Lumbar support, breathable mesh back, and 4D armrests.', features: ['Lumbar Support', 'Breathable Mesh', '4D Armrests', 'Height Adjustable', '5-Year Warranty'] },
  prod_003: { id: 'prod_003', name: 'Running Shoes Pro X', price: 89, category: 'Footwear', description: 'Lightweight running shoes with responsive cushioning and durable outsole. Engineered for performance runners.', features: ['Responsive Foam', 'Breathable Upper', 'Anti-slip Outsole', 'Lightweight 220g', 'Wide Toe Box'] },
  prod_004: { id: 'prod_004', name: 'Stainless Steel Water Bottle', price: 29, category: 'Accessories', description: 'Double-wall vacuum insulation keeps drinks cold 24hrs or hot 12hrs. BPA-free and dishwasher safe.', features: ['24hr Cold / 12hr Hot', 'BPA Free', '750ml Capacity', 'Leak-Proof Lid', 'Dishwasher Safe'] },
  prod_005: { id: 'prod_005', name: 'Smart Home Hub', price: 99, category: 'Electronics', description: 'Control all your smart home devices from one central hub. Compatible with 10,000+ devices across all major platforms.', features: ['Works with Alexa/Google', '10,000+ Compatible Devices', 'Zigbee + Z-Wave + WiFi', 'Local Processing', 'Mobile App'] },
  prod_006: { id: 'prod_006', name: 'Yoga Mat Premium', price: 45, category: 'Fitness', description: 'Non-slip, extra-thick yoga mat with alignment lines. Eco-friendly natural rubber with moisture-wicking surface.', features: ['6mm Thickness', 'Non-slip Surface', 'Alignment Lines', 'Eco Natural Rubber', 'Carry Strap Included'] },
  prod_007: { id: 'prod_007', name: 'Leather Wallet Slim', price: 59, category: 'Accessories', description: 'Minimalist genuine leather bifold wallet. Holds 6+ cards with RFID blocking protection.', features: ['Genuine Leather', 'RFID Blocking', '6+ Card Slots', 'Slim Profile 6mm', 'Gift Box Included'] },
  prod_008: { id: 'prod_008', name: 'Mechanical Keyboard TKL', price: 129, category: 'Electronics', description: 'Tenkeyless mechanical keyboard with hot-swappable switches. Per-key RGB backlighting and aircraft-grade aluminum frame.', features: ['Hot-Swap Switches', 'Per-Key RGB', 'Aluminum Frame', 'USB-C Detachable', 'N-Key Rollover'] },
  prod_009: { id: 'prod_009', name: 'Coffee Maker Deluxe', price: 79, category: 'Kitchen', description: 'Programmable 12-cup coffee maker with built-in grinder and thermal carafe. Wake up to freshly ground coffee.', features: ['Built-in Grinder', '12-Cup Thermal Carafe', 'Programmable Timer', 'Brew Strength Control', 'Auto Shutoff'] },
  prod_010: { id: 'prod_010', name: 'Sunglasses UV400', price: 39, category: 'Accessories', description: 'Classic polarized sunglasses with UV400 protection. Lightweight TR90 frame available in multiple colorways.', features: ['Polarized Lenses', 'UV400 Protection', 'TR90 Frame', 'Anti-Scratch Coating', 'Case Included'] },
};

export default function ProductPage() {
  const params = useParams();
  const handle = params?.handle as string;
  const product = PRODUCTS[handle];
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [hoverStartTime, setHoverStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (product) {
      tracker.productView({
        id: product.id,
        title: product.name,
        price: product.price,
        category: product.category
      });
    }
  }, [handle, product]);

  if (!product) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Product not found</p>
        <Link href="/search" className="text-indigo-600 underline">Back to search</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    tracker.addToCart({
      id: product.id,
      title: product.name,
      price: product.price,
      quantity: quantity,
      category: product.category
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleMouseEnter = () => setHoverStartTime(Date.now());
  const handleMouseLeave = () => {
    if (hoverStartTime) {
      if (Date.now() - hoverStartTime > 1000) {
        registerMicroHesitation();
      }
    }
    setHoverStartTime(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/" className="hover:text-slate-700">Home</Link>
        <span>/</span>
        <Link href="/search" className="hover:text-slate-700">Products</Link>
        <span>/</span>
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Image placeholder */}
        <div className="flex aspect-square items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 text-8xl">
          📦
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
              {product.category}
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{product.name}</h1>
            <p className="mt-3 text-3xl font-bold text-indigo-600">${product.price}</p>
          </div>

          <p className="text-slate-600 leading-relaxed">{product.description}</p>

          <ul className="space-y-2">
            {product.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                <svg className="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {/* Quantity */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Qty:</label>
            <div className="flex items-center rounded-xl border border-slate-200">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2 text-slate-500 hover:text-slate-900">−</button>
              <span className="min-w-[32px] text-center text-sm font-semibold">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-2 text-slate-500 hover:text-slate-900">+</button>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`rounded-xl py-4 text-sm font-semibold transition-all ${
              added
                ? 'bg-green-600 text-white'
                : 'bg-slate-900 text-white hover:bg-slate-700'
            }`}
          >
            {added ? '✓ Added to Cart' : 'Add to Cart'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            This interaction is being tracked by the analytics system
          </p>
        </div>
      </div>
    </div>
  );
}
