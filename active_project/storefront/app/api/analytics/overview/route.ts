// app/api/analytics/overview/route.ts
import { NextResponse } from 'next/server';
import { prisma } from 'lib/db';

export async function GET() {
  const [
    totalEvents,
    totalSessions,
    totalUsers,
    convertedSessions,
    bouncedSessions,
    totalRevenue,
    recentEvents,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.session.count(),
    prisma.userProfile.count(),
    prisma.session.count({ where: { converted: true } }),
    prisma.session.count({ where: { bounced: true } }),
    prisma.event.aggregate({ where: { eventType: 'purchase' }, _sum: { cartValue: true } }),
    prisma.event.count({ where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);

  // Time series: sessions per day for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dailySessions = await prisma.session.groupBy({
    by: ['startTime'],
    where: { startTime: { gte: thirtyDaysAgo } },
    _count: { id: true },
  });

  // Build daily buckets
  const dailyMap: Record<string, { sessions: number; conversions: number }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { sessions: 0, conversions: 0 };
  }

  const allSessions = await prisma.session.findMany({
    where: { startTime: { gte: thirtyDaysAgo } },
    select: { startTime: true, converted: true },
  });
  for (const s of allSessions) {
    const key = s.startTime.toISOString().slice(0, 10);
    if (dailyMap[key]) {
      dailyMap[key].sessions++;
      if (s.converted) dailyMap[key].conversions++;
    }
  }

  const timeSeries = Object.entries(dailyMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Segment distribution
  const segments = await prisma.userProfile.groupBy({
    by: ['segment'],
    _count: { id: true },
  });

  return NextResponse.json({
    kpis: {
      totalEvents,
      totalSessions,
      totalUsers,
      totalRevenue: parseFloat((totalRevenue._sum.cartValue || 0).toFixed(2)),
      conversionRate: totalSessions > 0 ? parseFloat((convertedSessions / totalSessions * 100).toFixed(2)) : 0,
      bounceRate: totalSessions > 0 ? parseFloat((bouncedSessions / totalSessions * 100).toFixed(2)) : 0,
      eventsLast24h: recentEvents,
      avgOrderValue: convertedSessions > 0
        ? parseFloat(((totalRevenue._sum.cartValue || 0) / convertedSessions).toFixed(2))
        : 0,
    },
    timeSeries,
    segments: segments.map((s) => ({ name: s.segment || 'unknown', count: s._count.id })),
  });
}
