// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Realistic demo products ──────────────────────────────────────────────────
const PRODUCTS = [
  { id: 'prod_001', name: 'Wireless Noise-Cancelling Headphones', category: 'electronics' },
  { id: 'prod_002', name: 'Ergonomic Office Chair', category: 'furniture' },
  { id: 'prod_003', name: 'Running Shoes Pro X', category: 'footwear' },
  { id: 'prod_004', name: 'Stainless Steel Water Bottle', category: 'accessories' },
  { id: 'prod_005', name: 'Smart Home Hub', category: 'electronics' },
  { id: 'prod_006', name: 'Yoga Mat Premium', category: 'fitness' },
  { id: 'prod_007', name: 'Leather Wallet Slim', category: 'accessories' },
  { id: 'prod_008', name: 'Mechanical Keyboard TKL', category: 'electronics' },
  { id: 'prod_009', name: 'Coffee Maker Deluxe', category: 'kitchen' },
  { id: 'prod_010', name: 'Sunglasses UV400', category: 'accessories' },
];

const PAGES = ['/', '/search', '/product', '/cart', '/checkout'];
const EVENT_TYPES = ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'checkout_step', 'purchase', 'search', 'category_click', 'remove_from_cart'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max));
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60 * 1000);
}

async function generateSession(
  userId: string,
  sessionId: string,
  baseTime: Date,
  scenario: 'converter' | 'browser' | 'bouncer' | 'abandoner'
) {
  const events: any[] = [];
  let t = new Date(baseTime);
  const advance = (seconds: number) => {
    t = new Date(t.getTime() + seconds * 1000);
    return new Date(t);
  };

  // Every session starts with a page view
  events.push({
    sessionId, userId, eventType: 'page_view',
    page: 'Home', path: '/', timestamp: advance(0),
  });

  if (scenario === 'bouncer') {
    // Bounce - only one page view
    return events;
  }

  advance(randomInt(10, 30));

  if (scenario === 'browser' || scenario === 'converter' || scenario === 'abandoner') {
    // Browse products
    events.push({
      sessionId, userId, eventType: 'page_view',
      page: 'Search', path: '/search', timestamp: advance(5),
    });

    const numProducts = randomInt(1, 4);
    for (let i = 0; i < numProducts; i++) {
      const product = randomFrom(PRODUCTS);
      events.push({
        sessionId, userId, eventType: 'product_view',
        page: 'Product', path: `/product/${product.id}`,
        productId: product.id, productName: product.name,
        timestamp: advance(randomInt(15, 60)),
      });
    }
  }

  if (scenario === 'converter' || scenario === 'abandoner') {
    // Add to cart
    const product = randomFrom(PRODUCTS);
    const cartValue = parseFloat(randomBetween(20, 250).toFixed(2));

    events.push({
      sessionId, userId, eventType: 'add_to_cart',
      page: 'Product', path: `/product/${product.id}`,
      productId: product.id, productName: product.name,
      cartValue, timestamp: advance(randomInt(10, 30)),
    });

    events.push({
      sessionId, userId, eventType: 'page_view',
      page: 'Cart', path: '/cart',
      cartValue, timestamp: advance(randomInt(5, 15)),
    });

    if (scenario === 'converter' || Math.random() > 0.4) {
      // Start checkout
      events.push({
        sessionId, userId, eventType: 'checkout_start',
        page: 'Checkout', path: '/checkout',
        cartValue, timestamp: advance(randomInt(10, 20)),
      });

      events.push({
        sessionId, userId, eventType: 'checkout_step',
        page: 'Checkout', path: '/checkout',
        cartValue, checkoutStep: 1, timestamp: advance(randomInt(20, 60)),
        metadata: JSON.stringify({ step: 'shipping' }),
      });

      if (scenario === 'converter') {
        events.push({
          sessionId, userId, eventType: 'checkout_step',
          page: 'Checkout', path: '/checkout',
          cartValue, checkoutStep: 2, timestamp: advance(randomInt(30, 90)),
          metadata: JSON.stringify({ step: 'payment' }),
        });

        events.push({
          sessionId, userId, eventType: 'purchase',
          page: 'Checkout', path: '/checkout/success',
          cartValue, timestamp: advance(randomInt(10, 30)),
        });
      }
    }
  }

  return events;
}

async function main() {
  console.log('🌱 Seeding database with realistic behavioral data...');

  // Clear existing data
  await prisma.event.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.productAnalytics.deleteMany();
  await prisma.funnelSnapshot.deleteMany();
  await prisma.insight.deleteMany();

  // Generate 200 users, 800 sessions over the past 30 days
  const allEvents: any[] = [];
  const sessions: any[] = [];
  const userMap: Record<string, any> = {};

  const NUM_USERS = 200;
  const NUM_SESSIONS = 800;

  for (let s = 0; s < NUM_SESSIONS; s++) {
    const userId = `user_${String(randomInt(1, NUM_USERS)).padStart(3, '0')}`;
    const sessionId = `sess_${String(s + 1).padStart(4, '0')}`;
    const hoursBack = randomBetween(0, 720); // last 30 days
    const baseTime = hoursAgo(hoursBack);

    // Realistic funnel: 30% bounce, 40% browse, 20% abandon, 10% convert
    const roll = Math.random();
    let scenario: 'converter' | 'browser' | 'bouncer' | 'abandoner';
    if (roll < 0.10) scenario = 'converter';
    else if (roll < 0.30) scenario = 'abandoner';
    else if (roll < 0.60) scenario = 'browser';
    else scenario = 'bouncer';

    const events = await generateSession(userId, sessionId, baseTime, scenario);
    allEvents.push(...events);

    // Build session record
    const sessionEnd = events.length > 1
      ? new Date(events[events.length - 1].timestamp.getTime() + 30000)
      : new Date(baseTime.getTime() + 15000);

    const duration = Math.floor((sessionEnd.getTime() - baseTime.getTime()) / 1000);
    const converted = scenario === 'converter';
    const bounced = scenario === 'bouncer';

    sessions.push({
      id: sessionId,
      userId,
      startTime: baseTime,
      endTime: sessionEnd,
      duration,
      pageViews: events.filter((e: any) => e.eventType === 'page_view').length,
      productViews: events.filter((e: any) => e.eventType === 'product_view').length,
      cartAdds: events.filter((e: any) => e.eventType === 'add_to_cart').length,
      searches: events.filter((e: any) => e.eventType === 'search').length,
      converted,
      bounced,
      checkoutReached: ['converter', 'abandoner'].includes(scenario),
      entryPage: '/',
      exitPage: events[events.length - 1]?.path || '/',
    });

    // Accumulate user profile stats
    if (!userMap[userId]) {
      userMap[userId] = {
        id: userId, totalSessions: 0, totalPageViews: 0,
        totalProductViews: 0, totalCartAdds: 0, totalPurchases: 0,
        totalRevenue: 0, sessionDurations: [], firstSeen: baseTime, lastSeen: baseTime,
      };
    }
    const u = userMap[userId];
    u.totalSessions++;
    u.totalPageViews += events.filter((e: any) => e.eventType === 'page_view').length;
    u.totalProductViews += events.filter((e: any) => e.eventType === 'product_view').length;
    u.totalCartAdds += events.filter((e: any) => e.eventType === 'add_to_cart').length;
    if (converted) {
      u.totalPurchases++;
      const cartValue = events.find((e: any) => e.eventType === 'purchase')?.cartValue || 0;
      u.totalRevenue += cartValue;
    }
    u.sessionDurations.push(duration);
    if (baseTime < u.firstSeen) u.firstSeen = baseTime;
    if (baseTime > u.lastSeen) u.lastSeen = baseTime;
  }

  // Batch insert events
  console.log(`  Inserting ${allEvents.length} events...`);
  for (let i = 0; i < allEvents.length; i += 500) {
    await prisma.event.createMany({ data: allEvents.slice(i, i + 500) });
  }

  // Insert sessions
  console.log(`  Inserting ${sessions.length} sessions...`);
  await prisma.session.createMany({ data: sessions });

  // Build and insert user profiles
  console.log(`  Building user profiles...`);
  const profiles = Object.values(userMap).map((u: any) => {
    const avgDuration = u.sessionDurations.reduce((a: number, b: number) => a + b, 0) / u.sessionDurations.length;
    const conversionRate = u.totalSessions > 0 ? u.totalPurchases / u.totalSessions : 0;
    const daysSinceLastSeen = (Date.now() - u.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
    const churnRisk = Math.min(1, daysSinceLastSeen / 14 * (1 - conversionRate * 2));
    const engagementScore = Math.min(100,
      (u.totalProductViews * 2) + (u.totalCartAdds * 5) + (u.totalPurchases * 20) + (u.totalSessions * 3)
    );

    let segment = 'casual';
    if (u.totalPurchases >= 2) segment = 'high_value';
    else if (churnRisk > 0.6) segment = 'at_risk';
    else if (u.totalSessions === 1) segment = 'new';

    return {
      id: u.id,
      totalSessions: u.totalSessions,
      totalPageViews: u.totalPageViews,
      totalProductViews: u.totalProductViews,
      totalCartAdds: u.totalCartAdds,
      totalPurchases: u.totalPurchases,
      totalRevenue: parseFloat(u.totalRevenue.toFixed(2)),
      avgSessionDuration: parseFloat(avgDuration.toFixed(1)),
      avgCartValue: u.totalPurchases > 0 ? parseFloat((u.totalRevenue / u.totalPurchases).toFixed(2)) : 0,
      conversionRate: parseFloat(conversionRate.toFixed(4)),
      bounceRate: 0,
      lastSeen: u.lastSeen,
      firstSeen: u.firstSeen,
      churnRisk: parseFloat(churnRisk.toFixed(4)),
      engagementScore: parseFloat(engagementScore.toFixed(1)),
      segment,
    };
  });

  await prisma.userProfile.createMany({ data: profiles });

  // Product analytics
  console.log('  Computing product analytics...');
  for (const product of PRODUCTS) {
    const views = await prisma.event.count({ where: { productId: product.id, eventType: 'product_view' } });
    const cartAdds = await prisma.event.count({ where: { productId: product.id, eventType: 'add_to_cart' } });
    const purchases = allEvents.filter((e: any) =>
      e.eventType === 'purchase' && e.productId === product.id
    ).length;

    await prisma.productAnalytics.upsert({
      where: { productId: product.id },
      update: { views, cartAdds, purchases, viewToCart: views > 0 ? cartAdds / views : 0, cartToPurchase: cartAdds > 0 ? purchases / cartAdds : 0 },
      create: {
        productId: product.id, productName: product.name,
        views, cartAdds, purchases,
        revenue: purchases * randomBetween(30, 200),
        viewToCart: views > 0 ? parseFloat((cartAdds / views).toFixed(4)) : 0,
        cartToPurchase: cartAdds > 0 ? parseFloat((purchases / cartAdds).toFixed(4)) : 0,
      },
    });
  }

  // Funnel snapshots (daily for last 30 days)
  console.log('  Building funnel snapshots...');
  for (let d = 0; d < 30; d++) {
    const dayStart = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const daySessions = sessions.filter((s: any) => s.startTime >= dayStart && s.startTime < dayEnd);
    const visitors = new Set(daySessions.map((s: any) => s.id)).size;
    const productViewers = daySessions.filter((s: any) => s.productViews > 0).length;
    const cartAdders = daySessions.filter((s: any) => s.cartAdds > 0).length;
    const checkoutStarters = daySessions.filter((s: any) => s.checkoutReached).length;
    const purchasers = daySessions.filter((s: any) => s.converted).length;

    await prisma.funnelSnapshot.create({
      data: { date: dayStart, period: 'daily', visitors, productViewers, cartAdders, checkoutStarters, purchasers },
    });
  }

  // Seeded prescriptive insights
  console.log('  Generating insights...');
  const productStats = await prisma.productAnalytics.findMany({ orderBy: { viewToCart: 'asc' } });
  const worstProduct = productStats[0];

  await prisma.insight.createMany({
    data: [
      {
        type: 'product_issue', severity: 'warning',
        title: `Low cart conversion: ${worstProduct?.productName}`,
        description: `"${worstProduct?.productName}" has ${worstProduct?.views} views but only ${(worstProduct?.viewToCart * 100).toFixed(1)}% add-to-cart rate — well below the 15% benchmark.`,
        entityId: worstProduct?.productId, entityName: worstProduct?.productName,
        metric: 'view_to_cart', value: worstProduct?.viewToCart, threshold: 0.15,
        action: 'Review product pricing, images, and description. Consider A/B testing.',
      },
      {
        type: 'funnel_leak', severity: 'critical',
        title: 'High checkout abandonment at Step 1',
        description: '62% of users who reach checkout abandon at the shipping step. This is significantly above the 40% industry benchmark.',
        metric: 'checkout_step1_abandonment', value: 0.62, threshold: 0.40,
        action: 'Simplify shipping form. Add progress indicator. Display estimated delivery date.',
      },
      {
        type: 'churn_alert', severity: 'warning',
        title: '38 users at high churn risk',
        description: '38 previously active users have not returned in 10+ days with no purchase history. Intervention recommended.',
        metric: 'churn_risk', value: 38, threshold: 10,
        action: 'Trigger re-engagement email campaign with personalized product recommendations.',
      },
      {
        type: 'opportunity', severity: 'info',
        title: 'Search-to-product conversion opportunity',
        description: 'Users who use the search function have 3.2x higher product view rate but only 12% use search. Increasing search visibility could drive engagement.',
        metric: 'search_usage_rate', value: 0.12, threshold: 0.30,
        action: 'Make search bar more prominent in navigation. Add autocomplete suggestions.',
      },
      {
        type: 'engagement_drop', severity: 'info',
        title: 'Mobile session duration 40% lower',
        description: 'Mobile users spend an average of 1m 20s vs 2m 18s for desktop users, suggesting mobile UX friction.',
        metric: 'mobile_session_duration', value: 80, threshold: 138,
        action: 'Audit mobile product pages. Optimize image loading. Review tap target sizes.',
      },
    ],
  });

  console.log('✅ Seed complete!');
  console.log(`   ${allEvents.length} events | ${sessions.length} sessions | ${profiles.length} users`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
