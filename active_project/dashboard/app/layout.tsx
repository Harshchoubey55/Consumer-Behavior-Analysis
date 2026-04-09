import type { Metadata } from 'next';
import Sidebar from '../components/layout/sidebar';
import '../app/globals.css';

export const metadata: Metadata = {
  title: { default: 'BehaviorLens', template: '%s | BehaviorLens' },
  description: 'Internal consumer behavior analytics platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="noise">
        <div className="flex min-h-screen relative z-10">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
