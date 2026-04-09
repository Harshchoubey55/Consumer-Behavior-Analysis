// app/api/events/route.ts
// Ingestion endpoint: receives batches of tracking events and persists them

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { z } from 'zod';

const EventSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  eventType: z.enum([
    'page_view', 'product_view', 'category_click',
    'add_to_cart', 'remove_from_cart', 'checkout_start',
    'checkout_step', 'purchase', 'search',
  ]),
  page: z.string(),
  path: z.string(),
  referrer: z.string().optional(),
  productId: z.string().optional(),
  productName: z.string().optional(),
  categoryId: z.string().optional(),
  searchQuery: z.string().optional(),
  cartValue: z.number().optional(),
  checkoutStep: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(50),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid event payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const eventsToInsert = parsed.data.events.map((e) => ({
      sessionId: e.sessionId,
      userId: e.userId || null,
      eventType: e.eventType,
      page: e.page,
      path: e.path,
      referrer: e.referrer || null,
      productId: e.productId || null,
      productName: e.productName || null,
      categoryId: e.categoryId || null,
      searchQuery: e.searchQuery || null,
      cartValue: e.cartValue || null,
      checkoutStep: e.checkoutStep || null,
      metadata: e.metadata ? JSON.stringify(e.metadata) : null,
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    }));

    await prisma.event.createMany({ data: eventsToInsert });

    return NextResponse.json({ received: eventsToInsert.length }, { status: 201 });
  } catch (error) {
    console.error('[events] ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: recent events for debugging/monitoring
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
  const events = await prisma.event.findMany({
    orderBy: { timestamp: 'desc' },
    take: Math.min(limit, 500),
  });
  return NextResponse.json(events);
}
