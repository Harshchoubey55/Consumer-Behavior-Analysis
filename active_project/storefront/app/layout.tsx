import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import PageTracker from 'components/tracking/page-tracker';
import { InterventionProvider } from 'components/tracking/InterventionProvider';
import Navbar from 'components/layout/navbar';
import './globals.css';

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: 'Consumer Analytics Store', template: '%s | Analytics Store' },
  robots: { follow: true, index: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-neutral-50 text-black antialiased dark:bg-neutral-900 dark:text-white">
        <InterventionProvider>
          {/* Page tracker: fires page_view events on every route change */}
          <PageTracker />
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-400 dark:border-neutral-700">
            <p>© {new Date().getFullYear()} Consumer Behavior Analytics System · Internal Demo</p>
            <a href="/dashboard" className="mt-2 inline-block text-indigo-500 hover:text-indigo-700 underline underline-offset-4">
              Analytics Dashboard →
            </a>
          </footer>
        </InterventionProvider>
      </body>
    </html>
  );
}
