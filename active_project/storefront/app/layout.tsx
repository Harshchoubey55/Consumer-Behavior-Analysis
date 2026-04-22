import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import PageTracker from 'components/tracking/page-tracker';
import { InterventionProvider } from 'components/tracking/InterventionProvider';
import { CartProvider } from 'components/cart/CartProvider';
import { AuthProvider } from 'components/auth/AuthProvider';
import { WishlistProvider } from 'components/wishlist/WishlistProvider';
import { ToastProvider } from 'components/ui/Toast';
import Navbar from 'components/layout/navbar';
import './globals.css';

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: 'ZeroError', template: '%s — ZeroError' },
  description: 'Premium lifestyle goods. Curated for people who care about the details.',
  robots: { follow: true, index: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-stone-50 text-stone-900 antialiased">
        <AuthProvider>
          <ToastProvider>
            <WishlistProvider>
              <CartProvider>
                <InterventionProvider>
                  <PageTracker />
                  <Navbar />
                  <main className="min-h-screen">{children}</main>
                  <footer className="border-t border-stone-200 bg-stone-900 text-stone-400">
                    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
                      <div className="grid gap-8 sm:grid-cols-3">
                        <div>
                          <p className="text-sm font-semibold tracking-wide text-white">ZeroError</p>
                          <p className="mt-2 text-xs leading-relaxed">
                            Premium lifestyle goods, curated for people who care about the details.
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Shop</p>
                          <ul className="mt-3 space-y-2 text-xs">
                            <li><a href="/search" className="hover:text-white transition-colors">All Products</a></li>
                            <li><a href="/search?q=electronics" className="hover:text-white transition-colors">Electronics</a></li>
                            <li><a href="/search?q=accessories" className="hover:text-white transition-colors">Accessories</a></li>
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Support</p>
                          <ul className="mt-3 space-y-2 text-xs">
                            <li><span className="cursor-default">Shipping & Returns</span></li>
                            <li><span className="cursor-default">Contact Us</span></li>
                            <li><span className="cursor-default">FAQ</span></li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-10 border-t border-stone-800 pt-6 text-center text-xs text-stone-600">
                        © {new Date().getFullYear()} ZeroError. All rights reserved.
                      </div>
                    </div>
                  </footer>
                </InterventionProvider>
              </CartProvider>
            </WishlistProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
