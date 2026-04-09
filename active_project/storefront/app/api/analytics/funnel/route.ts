// app/api/analytics/funnel/route.ts
import { NextResponse } from 'next/server';
import { prisma } from 'lib/db';

export async function GET() {
  // Funnel: unique sessions at each stage
  const [
    visitors,
    productViewers,
    cartAdders,
    checkoutStarters,
    purchasers,
  ] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { productViews: { gt: 0 } } }),
    prisma.session.count({ where: { cartAdds: { gt: 0 } } }),
    prisma.session.count({ where: { checkoutReached: true } }),
    prisma.session.count({ where: { converted: true } }),
  ]);

  const steps = [
    { name: 'Visited Site', value: visitors, stage: 'awareness' },
    { name: 'Viewed Product', value: productViewers, stage: 'interest' },
    { name: 'Added to Cart', value: cartAdders, stage: 'intent' },
    { name: 'Started Checkout', value: checkoutStarters, stage: 'action' },
    { name: 'Purchased', value: purchasers, stage: 'conversion' },
  ];

  // Drop-off rates between each step
  const funnel = steps.map((step, i) => {
    const prev = i > 0 ? steps[i - 1].value : step.value;
    const dropOff = prev > 0 ? parseFloat(((1 - step.value / prev) * 100).toFixed(1)) : 0;
    const conversionFromTop = visitors > 0 ? parseFloat((step.value / visitors * 100).toFixed(1)) : 0;
    return { ...step, dropOff, conversionFromTop };
  });

  // Daily funnel snapshots for trend
  const snapshots = await prisma.funnelSnapshot.findMany({
    where: { period: 'daily' },
    orderBy: { date: 'asc' },
    take: 30,
  });

  // Checkout step analysis
  const checkoutEvents = await prisma.event.groupBy({
    by: ['checkoutStep'],
    where: { eventType: 'checkout_step', checkoutStep: { not: null } },
    _count: { id: true },
  });

  const checkoutSteps = checkoutEvents
    .filter((e) => e.checkoutStep !== null)
    .sort((a, b) => (a.checkoutStep || 0) - (b.checkoutStep || 0))
    .map((e) => ({
      step: e.checkoutStep,
      label: e.checkoutStep === 1 ? 'Shipping' : e.checkoutStep === 2 ? 'Payment' : `Step ${e.checkoutStep}`,
      users: e._count.id,
    }));

  return NextResponse.json({ funnel, snapshots, checkoutSteps });
}
