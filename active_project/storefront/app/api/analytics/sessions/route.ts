// app/api/analytics/sessions/route.ts
import { NextResponse } from 'next/server';
import { prisma } from 'lib/db';

export async function GET() {
  const [
    avgDuration,
    avgPageViews,
    avgProductViews,
  ] = await Promise.all([
    prisma.session.aggregate({ _avg: { duration: true, pageViews: true, productViews: true } }),
    prisma.session.aggregate({ _avg: { pageViews: true } }),
    prisma.session.aggregate({ _avg: { productViews: true } }),
  ]);

  // Sessions by hour of day (engagement heatmap data)
  const allSessions = await prisma.session.findMany({
    select: { startTime: true, duration: true, converted: true, bounced: true, productViews: true },
    take: 2000,
    orderBy: { startTime: 'desc' },
  });

  const byHour: Record<number, { sessions: number; conversions: number }> = {};
  for (let h = 0; h < 24; h++) byHour[h] = { sessions: 0, conversions: 0 };

  for (const s of allSessions) {
    const h = new Date(s.startTime).getHours();
    byHour[h].sessions++;
    if (s.converted) byHour[h].conversions++;
  }

  const hourlyDistribution = Object.entries(byHour).map(([hour, v]) => ({
    hour: parseInt(hour),
    label: `${hour}:00`,
    ...v,
    rate: v.sessions > 0 ? parseFloat((v.conversions / v.sessions * 100).toFixed(1)) : 0,
  }));

  // Duration distribution buckets
  const durationBuckets = [
    { label: '< 30s', min: 0, max: 30 },
    { label: '30s–1m', min: 30, max: 60 },
    { label: '1–3m', min: 60, max: 180 },
    { label: '3–10m', min: 180, max: 600 },
    { label: '> 10m', min: 600, max: Infinity },
  ];

  const durationDistribution = await Promise.all(
    durationBuckets.map(async (bucket) => ({
      label: bucket.label,
      count: await prisma.session.count({
        where: {
          duration: {
            gte: bucket.min,
            ...(bucket.max !== Infinity ? { lt: bucket.max } : {}),
          },
        },
      }),
    }))
  );

  return NextResponse.json({
    averages: {
      duration: parseFloat((avgDuration._avg.duration || 0).toFixed(0)),
      pageViews: parseFloat((avgDuration._avg.pageViews || 0).toFixed(1)),
      productViews: parseFloat((avgDuration._avg.productViews || 0).toFixed(1)),
    },
    hourlyDistribution,
    durationDistribution,
    recentSessions: allSessions.slice(0, 50),
  });
}
