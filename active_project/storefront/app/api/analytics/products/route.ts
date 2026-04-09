// app/api/analytics/products/route.ts
import { NextResponse } from 'next/server';
import { prisma } from 'lib/db';

export async function GET() {
  const products = await prisma.productAnalytics.findMany({
    orderBy: { views: 'desc' },
  });

  // Top products by various metrics
  const byRevenue = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const byConversion = [...products]
    .filter((p) => p.views >= 10)
    .sort((a, b) => b.viewToCart - a.viewToCart)
    .slice(0, 10);
  const lowConversion = [...products]
    .filter((p) => p.views >= 20 && p.viewToCart < 0.1)
    .sort((a, b) => b.views - a.views);

  return NextResponse.json({
    all: products,
    byRevenue,
    byConversion,
    lowConversion,
  });
}
