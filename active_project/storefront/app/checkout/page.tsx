'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from 'components/cart/CartProvider';
import { tracker } from 'lib/tracking/tracker';

const STEPS = ['Shipping', 'Payment', 'Review'];

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);

  // Form state
  const [shipping, setShipping] = useState({ name: '', email: '', address: '', city: '', zip: '' });
  const [payment, setPayment] = useState({ card: '', expiry: '', cvv: '' });

  useEffect(() => {
    tracker.checkoutStep(step + 1);
  }, [step]);

  // Redirect if cart empty and not on completion
  useEffect(() => {
    if (items.length === 0 && !complete) {
      router.push('/cart');
    }
  }, [items.length, complete, router]);

  const shippingCost = total >= 50 ? 0 : 4.99;
  const grandTotal = total + shippingCost;

  const handleComplete = () => {
    // Fire purchase event for each item
    items.forEach((item) => {
      tracker.purchase({ id: item.id, price: item.price * item.quantity });
    });
    setComplete(true);
    clearCart();
  };

  if (complete) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">Order Confirmed</h1>
        <p className="max-w-sm text-center text-sm text-stone-500">
          Thank you for your purchase. Your order has been placed and will be shipped shortly.
        </p>
        <Link
          href="/search"
          className="btn-press mt-4 rounded-full bg-stone-900 px-8 py-3 text-sm font-semibold text-white hover:bg-stone-800"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Checkout</h1>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              i < step ? 'bg-green-600 text-white' :
              i === step ? 'bg-stone-900 text-white' :
              'bg-stone-100 text-stone-400'
            }`}>
              {i < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              i === step ? 'text-stone-900' : 'text-stone-400'
            }`}>
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-4 h-px w-10 ${i < step ? 'bg-green-500' : 'bg-stone-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        {/* Form area */}
        <div className="lg:col-span-3">
          {/* Step 1: Shipping */}
          {step === 0 && (
            <form onSubmit={(e) => { e.preventDefault(); setStep(1); }} className="animate-fade-in space-y-4">
              <h2 className="text-lg font-semibold text-stone-900">Shipping Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-stone-500">Full Name</label>
                  <input
                    required
                    pattern="[A-Za-z\s]{2,50}"
                    title="Please enter a valid name (letters and spaces only)."
                    value={shipping.name}
                    maxLength={50}
                    onChange={(e) => setShipping({ ...shipping, name: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="John Doe"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-stone-500">Email</label>
                  <input
                    required
                    type="email"
                    value={shipping.email}
                    onChange={(e) => setShipping({ ...shipping, email: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-stone-500">Address</label>
                  <input
                    required
                    value={shipping.address}
                    onChange={(e) => setShipping({ ...shipping, address: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">City</label>
                  <input
                    required
                    pattern="[A-Za-z\s]{2,50}"
                    title="Please enter a valid city name (letters only)."
                    value={shipping.city}
                    maxLength={50}
                    onChange={(e) => setShipping({ ...shipping, city: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="New York"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">ZIP Code</label>
                  <input
                    required
                    type="text"
                    pattern="[0-9]{5,10}"
                    title="Please enter a numeric ZIP Code."
                    maxLength={10}
                    value={shipping.zip}
                    onChange={(e) => setShipping({ ...shipping, zip: e.target.value.replace(/[^0-9]/g, '') })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="10001"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn-press mt-6 w-full rounded-xl bg-stone-900 py-4 text-sm font-semibold text-white hover:bg-stone-800"
              >
                Continue to Payment
              </button>
            </form>
          )}

          {/* Step 2: Payment */}
          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="animate-fade-in space-y-4">
              <h2 className="text-lg font-semibold text-stone-900">Payment Method</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Card Number</label>
                  <input
                    required
                    type="text"
                    pattern="[0-9]{16}"
                    title="Please enter a 16-digit card number"
                    value={payment.card}
                    onChange={(e) => setPayment({ ...payment, card: e.target.value.replace(/[^0-9]/g, '') })}
                    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="4242424242424242"
                    maxLength={16}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Expiry</label>
                    <input
                      required
                      type="text"
                      pattern="(0[1-9]|1[0-2])\/?([0-9]{2})"
                      title="Please enter an expiry date in MM/YY format"
                      value={payment.expiry}
                      onChange={(e) => setPayment({ ...payment, expiry: e.target.value.replace(/[^0-9/]/g, '') })}
                      className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                      placeholder="MM/YY"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">CVV</label>
                    <input
                      required
                      type="password"
                      pattern="[0-9]{3,4}"
                      title="Please enter a 3 or 4 digit CVV"
                      value={payment.cvv}
                      onChange={(e) => setPayment({ ...payment, cvv: e.target.value.replace(/[^0-9]/g, '') })}
                      className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="rounded-xl border border-stone-200 px-6 py-3.5 text-sm font-medium text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-1 focus:ring-stone-500"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-press flex-1 rounded-xl bg-stone-900 py-3.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-500"
                >
                  Review Order
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Review */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <h2 className="text-lg font-semibold text-stone-900">Review Your Order</h2>

              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Shipping to</p>
                <p className="mt-2 text-sm text-stone-700">{shipping.name || 'Name'}</p>
                <p className="text-sm text-stone-500">{shipping.address || 'Address'}, {shipping.city || 'City'} {shipping.zip || 'ZIP'}</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Payment</p>
                <p className="mt-2 text-sm text-stone-700">Card ending in {(payment.card || '    ').slice(-4)}</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Items</p>
                <div className="mt-3 divide-y divide-stone-100">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-stone-800">{item.name}</p>
                        <p className="text-xs text-stone-400">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-stone-200 px-6 py-3.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  className="btn-press flex-1 rounded-xl bg-green-700 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-green-800"
                >
                  Place Order — ₹${grandTotal.toFixed(2)}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-stone-900">Order Summary</h3>
            <div className="mt-4 divide-y divide-stone-100">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    <Image src={item.image} alt={item.name} fill className="object-cover" sizes="40px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-stone-700">{item.name}</p>
                    <p className="text-[11px] text-stone-400">×{item.quantity}</p>
                  </div>
                  <p className="text-xs font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Subtotal</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Shipping</span>
                <span>{shippingCost === 0 ? 'Free' : `₹${shippingCost.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold text-stone-900">
                <span>Total</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
