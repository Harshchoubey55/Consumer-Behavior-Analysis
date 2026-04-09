// lib/analytics/processor.ts
// Post-ingestion processing: sessionization, feature extraction, metric derivation

import { prisma } from 'lib/db';

// ── Sessionization ────────────────────────────────────────────────────────────
// Takes raw events and builds session-level behavioral summaries

export async function processSessions(): Promise<void> {
  // Get all unprocessed session IDs (events not yet in Session table)
  const processedIds = new Set(
    (await prisma.session.findMany({ select: { id: true } })).map((s) => s.id)
  );

  const rawSessionIds = await prisma.event.groupBy({
    by: ['sessionId'],
    _count: { id: true },
  });

  const unprocessedIds = rawSessionIds
    .map((s) => s.sessionId)
    .filter((id) => !processedIds.has(id));

  for (const sessionId of unprocessedIds) {
    const events = await prisma.event.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) continue;

    const first = events[0];
    const last = events[events.length - 1];
    const duration = Math.floor(
      (last.timestamp.getTime() - first.timestamp.getTime()) / 1000
    );

    await prisma.session.upsert({
      where: { id: sessionId },
      update: {},
      create: {
        id: sessionId,
        userId: first.userId,
        startTime: first.timestamp,
        endTime: last.timestamp,
        duration,
        pageViews: events.filter((e) => e.eventType === 'page_view').length,
        productViews: events.filter((e) => e.eventType === 'product_view').length,
        cartAdds: events.filter((e) => e.eventType === 'add_to_cart').length,
        searches: events.filter((e) => e.eventType === 'search').length,
        converted: events.some((e) => e.eventType === 'purchase'),
        bounced: events.length <= 1,
        checkoutReached: events.some(
          (e) => e.eventType === 'checkout_start' || e.eventType === 'checkout_step'
        ),
        entryPage: first.path,
        exitPage: last.path,
      },
    });
  }
}

// ── User Profile Aggregation ──────────────────────────────────────────────────
export async function updateUserProfiles(): Promise<void> {
  const userIds = await prisma.event.groupBy({ by: ['userId'] });

  for (const { userId } of userIds) {
    if (!userId) continue;

    const sessions = await prisma.session.findMany({ where: { userId } });
    if (sessions.length === 0) continue;

    const totalSessions = sessions.length;
    const totalPageViews = sessions.reduce((sum, s) => sum + s.pageViews, 0);
    const totalProductViews = sessions.reduce((sum, s) => sum + s.productViews, 0);
    const totalCartAdds = sessions.reduce((sum, s) => sum + s.cartAdds, 0);
    const totalPurchases = sessions.filter((s) => s.converted).length;

    const purchaseEvents = await prisma.event.findMany({
      where: { userId, eventType: 'purchase' },
    });
    const totalRevenue = purchaseEvents.reduce((sum, e) => sum + (e.cartValue || 0), 0);

    const avgSessionDuration =
      sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions;

    const conversionRate = totalPurchases / totalSessions;
    const bounceRate =
      sessions.filter((s) => s.bounced).length / totalSessions;

    const lastSession = sessions.sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    )[0];
    const firstSession = sessions.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    )[0];

    // Churn risk: recency + frequency heuristic
    const daysSinceLastSeen =
      (Date.now() - lastSession.startTime.getTime()) / (1000 * 60 * 60 * 24);
    const churnRisk = Math.min(
      1,
      (daysSinceLastSeen / 14) * (1 - Math.min(conversionRate * 3, 0.9))
    );

    // Engagement score: weighted sum of behavioral signals
    const engagementScore = Math.min(
      100,
      totalProductViews * 2 +
        totalCartAdds * 5 +
        totalPurchases * 20 +
        totalSessions * 3 -
        bounceRate * 20
    );

    let segment = 'casual';
    if (totalPurchases >= 2) segment = 'high_value';
    else if (churnRisk > 0.6) segment = 'at_risk';
    else if (totalSessions === 1) segment = 'new';

    await prisma.userProfile.upsert({
      where: { id: userId },
      update: {
        totalSessions,
        totalPageViews,
        totalProductViews,
        totalCartAdds,
        totalPurchases,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        avgSessionDuration: parseFloat(avgSessionDuration.toFixed(1)),
        avgCartValue:
          totalPurchases > 0
            ? parseFloat((totalRevenue / totalPurchases).toFixed(2))
            : 0,
        conversionRate: parseFloat(conversionRate.toFixed(4)),
        bounceRate: parseFloat(bounceRate.toFixed(4)),
        lastSeen: lastSession.startTime,
        firstSeen: firstSession.startTime,
        churnRisk: parseFloat(churnRisk.toFixed(4)),
        engagementScore: parseFloat(engagementScore.toFixed(1)),
        segment,
      },
      create: {
        id: userId,
        totalSessions,
        totalPageViews,
        totalProductViews,
        totalCartAdds,
        totalPurchases,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        avgSessionDuration: parseFloat(avgSessionDuration.toFixed(1)),
        avgCartValue:
          totalPurchases > 0
            ? parseFloat((totalRevenue / totalPurchases).toFixed(2))
            : 0,
        conversionRate: parseFloat(conversionRate.toFixed(4)),
        bounceRate: parseFloat(bounceRate.toFixed(4)),
        lastSeen: lastSession.startTime,
        firstSeen: firstSession.startTime,
        churnRisk: parseFloat(churnRisk.toFixed(4)),
        engagementScore: parseFloat(engagementScore.toFixed(1)),
        segment,
      },
    });
  }
}

// ── Product Analytics ─────────────────────────────────────────────────────────
export async function updateProductAnalytics(): Promise<void> {
  const products = await prisma.event.groupBy({
    by: ['productId', 'productName'],
    where: { productId: { not: null } },
    _count: { id: true },
  });

  for (const product of products) {
    if (!product.productId) continue;

    const views = await prisma.event.count({
      where: { productId: product.productId, eventType: 'product_view' },
    });
    const cartAdds = await prisma.event.count({
      where: { productId: product.productId, eventType: 'add_to_cart' },
    });
    const purchaseEvents = await prisma.event.findMany({
      where: { productId: product.productId, eventType: 'purchase' },
    });
    const purchases = purchaseEvents.length;
    const revenue = purchaseEvents.reduce((sum, e) => sum + (e.cartValue || 0), 0);

    await prisma.productAnalytics.upsert({
      where: { productId: product.productId },
      update: {
        views,
        cartAdds,
        purchases,
        revenue: parseFloat(revenue.toFixed(2)),
        viewToCart: views > 0 ? parseFloat((cartAdds / views).toFixed(4)) : 0,
        cartToPurchase:
          cartAdds > 0 ? parseFloat((purchases / cartAdds).toFixed(4)) : 0,
      },
      create: {
        productId: product.productId,
        productName: product.productName || 'Unknown',
        views,
        cartAdds,
        purchases,
        revenue: parseFloat(revenue.toFixed(2)),
        viewToCart: views > 0 ? parseFloat((cartAdds / views).toFixed(4)) : 0,
        cartToPurchase:
          cartAdds > 0 ? parseFloat((purchases / cartAdds).toFixed(4)) : 0,
      },
    });
  }
}

// ── Prescriptive Insights Generator ──────────────────────────────────────────
// Rule-based reasoning layer that translates metrics into actionable insights

export async function generateInsights(): Promise<void> {
  // Clear old auto-generated insights
  await prisma.insight.deleteMany({ where: { dismissed: false } });

  const insights: any[] = [];

  // Rule 1: Products with high views but low cart conversion
  const products = await prisma.productAnalytics.findMany({
    where: { views: { gte: 10 } },
  });

  for (const p of products) {
    if (p.viewToCart < 0.05 && p.views > 20) {
      insights.push({
        type: 'product_issue',
        severity: p.views > 100 ? 'critical' : 'warning',
        title: `Low cart conversion: ${p.productName}`,
        description: `"${p.productName}" has ${p.views} views but only ${(p.viewToCart * 100).toFixed(1)}% add-to-cart rate (benchmark: 15%).`,
        entityId: p.productId,
        entityName: p.productName,
        metric: 'view_to_cart',
        value: p.viewToCart,
        threshold: 0.15,
        action: 'Review product pricing, images, and description. Consider A/B testing with different price points.',
      });
    }

    if (p.cartToPurchase < 0.3 && p.cartAdds > 10) {
      insights.push({
        type: 'funnel_leak',
        severity: 'warning',
        title: `High cart abandonment: ${p.productName}`,
        description: `${(100 - p.cartToPurchase * 100).toFixed(0)}% of users who add "${p.productName}" to cart don't complete purchase.`,
        entityId: p.productId,
        entityName: p.productName,
        metric: 'cart_to_purchase',
        value: p.cartToPurchase,
        threshold: 0.3,
        action: 'Add urgency signals (limited stock), simplify checkout, or offer free shipping threshold.',
      });
    }
  }

  // Rule 2: Checkout step drop-off
  const checkoutStep1 = await prisma.event.count({ where: { eventType: 'checkout_start' } });
  const checkoutStep2 = await prisma.event.count({ where: { eventType: 'checkout_step', checkoutStep: 2 } });
  const purchases = await prisma.event.count({ where: { eventType: 'purchase' } });

  if (checkoutStep1 > 0) {
    const step1DropOff = 1 - checkoutStep2 / checkoutStep1;
    if (step1DropOff > 0.4) {
      insights.push({
        type: 'funnel_leak',
        severity: 'critical',
        title: 'Checkout abandonment at shipping step',
        description: `${(step1DropOff * 100).toFixed(0)}% of users drop off at the first checkout step (benchmark: <40%).`,
        metric: 'checkout_step1_abandonment',
        value: step1DropOff,
        threshold: 0.4,
        action: 'Simplify shipping form. Auto-fill address where possible. Display estimated delivery time.',
      });
    }
  }

  // Rule 3: High churn risk users
  const churnCount = await prisma.userProfile.count({ where: { churnRisk: { gte: 0.7 } } });
  if (churnCount > 5) {
    insights.push({
      type: 'churn_alert',
      severity: churnCount > 20 ? 'critical' : 'warning',
      title: `${churnCount} users at high churn risk`,
      description: `${churnCount} previously active users have a churn risk score ≥70%. They haven't returned recently.`,
      metric: 'high_churn_users',
      value: churnCount,
      threshold: 5,
      action: 'Launch targeted re-engagement email campaign with personalized product recommendations.',
    });
  }

  // Rule 4: Overall bounce rate
  const totalSessions = await prisma.session.count();
  const bouncedSessions = await prisma.session.count({ where: { bounced: true } });
  const bounceRate = totalSessions > 0 ? bouncedSessions / totalSessions : 0;

  if (bounceRate > 0.5) {
    insights.push({
      type: 'engagement_drop',
      severity: 'warning',
      title: 'High overall bounce rate',
      description: `${(bounceRate * 100).toFixed(1)}% of sessions bounce after viewing only one page (benchmark: <40%).`,
      metric: 'bounce_rate',
      value: bounceRate,
      threshold: 0.5,
      action: 'Improve homepage content, add featured products, and ensure fast page load times.',
    });
  }

  // Rule 5: Low conversion rate
  const convertedSessions = await prisma.session.count({ where: { converted: true } });
  const conversionRate = totalSessions > 0 ? convertedSessions / totalSessions : 0;

  if (conversionRate < 0.03) {
    insights.push({
      type: 'opportunity',
      severity: 'info',
      title: 'Conversion rate below benchmark',
      description: `Overall session conversion rate is ${(conversionRate * 100).toFixed(2)}% — below the 3% e-commerce benchmark.`,
      metric: 'session_conversion_rate',
      value: conversionRate,
      threshold: 0.03,
      action: 'Review full funnel. Focus on products with high view counts but low conversion.',
    });
  }

  if (insights.length > 0) {
    await prisma.insight.createMany({ data: insights });
  }
}

// ── Full Processing Pipeline ──────────────────────────────────────────────────
export async function runFullPipeline(): Promise<{ duration: number; message: string }> {
  const start = Date.now();
  await processSessions();
  await updateUserProfiles();
  await updateProductAnalytics();
  await generateInsights();
  const duration = Date.now() - start;
  return { duration, message: `Pipeline completed in ${duration}ms` };
}
