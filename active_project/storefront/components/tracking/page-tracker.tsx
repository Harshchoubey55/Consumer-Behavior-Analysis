'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { tracker } from 'lib/tracking/tracker';

const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/search': 'Search',
  '/cart': 'Cart',
  '/checkout': 'Checkout',
};

export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    tracker.pageView(pathname);
  }, [pathname]);

  return null;
}
