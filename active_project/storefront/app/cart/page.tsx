'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from 'components/cart/CartProvider';
import { tracker } from 'lib/tracking/tracker';

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();

  const handleRemove = (id: string, name: string) => {
    tracker.removeFromCart(id, name);
    removeItem(id);
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <svg className="h-16 w-16 text-stone-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
        <p className="text-lg font-medium text-stone-700">Your bag is empty</p>
        <Link href="/search" className="btn-press mt-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-stone-800">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Your Bag</h1>
      <p className="mt-1 text-sm text-stone-500">{items.reduce((s, i) => s + i.quantity, 0)} items</p>

      <div className="mt-8 divide-y divide-stone-100">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 py-6">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100">
              <Image src={item.image} alt={item.name} fill className="object-cover" sizes="96px" />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <div className="flex justify-between">
                <div>
                  <Link href={`/product/${item.id}`} className="text-sm font-medium text-stone-800 hover:underline">
                    {item.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-stone-400">{item.category}</p>
                </div>
                <p className="text-sm font-semibold text-stone-900">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-stone-200">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-900"
                  >
                    −
                  </button>
                  <span className="min-w-[28px] text-center text-xs font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-900"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => handleRemove(item.id, item.name)}
                  className="text-xs text-stone-400 transition-colors hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Subtotal</span>
          <span className="font-semibold text-stone-900">${total.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-stone-500">Shipping</span>
          <span className="text-stone-600">{total >= 50 ? 'Free' : '$4.99'}</span>
        </div>
        <div className="mt-4 border-t border-stone-100 pt-4 flex justify-between">
          <span className="font-semibold text-stone-900">Total</span>
          <span className="text-lg font-semibold text-stone-900">
            ${(total + (total >= 50 ? 0 : 4.99)).toFixed(2)}
          </span>
        </div>

        <Link
          href="/checkout"
          className="btn-press mt-6 block w-full rounded-xl bg-stone-900 py-4 text-center text-sm font-semibold text-white transition-colors hover:bg-stone-800"
        >
          Proceed to Checkout
        </Link>
        <Link
          href="/search"
          className="mt-3 block w-full text-center text-sm text-stone-500 transition-colors hover:text-stone-700"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
