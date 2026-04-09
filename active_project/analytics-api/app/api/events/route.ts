import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

type EventPayload = {
  event_type: string;
  session_id: string;
  user_id?: string;
  page_url?: string;
  page_type?: string;
  referrer?: string;
  product_id?: string;
  product_title?: string;
  product_price?: number;
  category?: string;
  quantity?: number;
  search_query?: string;
  checkout_step?: number;
  properties?: Record<string, unknown>;
  client_ts?: string;
  device_type?: string;
};

const VALID_EVENT_TYPES = new Set([
  'page_view', 'product_view', 'add_to_cart', 'remove_from_cart',
  'search', 'checkout_step', 'purchase', 'category_click',
  'session_start', 'session_end', 'click'
]);

const VALID_PAGE_TYPES = new Set([
  'home', 'plp', 'pdp', 'cart', 'checkout', 'search', 'other'
]);

function hashIp(ip: string): string {
  // One-way hash for privacy compliance
  const hash = require('crypto').createHash('sha256').update(ip + (process.env.IP_SALT || 'salt')).digest('hex');
  return hash.substring(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    const body: EventPayload | EventPayload[] = await req.json();
    const events = Array.isArray(body) ? body : [body];

    if (events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 });
    }

    if (events.length > 50) {
      return NextResponse.json({ error: 'Max 50 events per batch' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const ipHash = hashIp(ip);

    const inserted: string[] = [];
    const errors: string[] = [];

    for (const event of events) {
      // Validation
      if (!event.event_type || !VALID_EVENT_TYPES.has(event.event_type)) {
        errors.push(`Invalid event_type: ${event.event_type}`);
        continue;
      }
      if (!event.session_id || typeof event.session_id !== 'string') {
        errors.push('Missing session_id');
        continue;
      }

      const eventId = uuidv4();
      const clientTs = event.client_ts 
        ? new Date(event.client_ts).toISOString() 
        : new Date().toISOString();

      // Detect device type from user agent
      let deviceType = event.device_type || 'desktop';
      if (!event.device_type) {
        if (/mobile|android|iphone|ipad/i.test(userAgent)) {
          deviceType = /ipad|tablet/i.test(userAgent) ? 'tablet' : 'mobile';
        }
      }

      await query(`
        INSERT INTO raw_events (
          event_id, event_type, session_id, user_id,
          page_url, page_type, referrer,
          product_id, product_title, product_price,
          category, quantity, search_query, checkout_step,
          properties, client_ts, server_ts,
          ip_hash, user_agent, device_type
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, NOW(), $17, $18, $19
        )
        ON CONFLICT (event_id) DO NOTHING
      `, [
        eventId,
        event.event_type,
        event.session_id.substring(0, 128),
        event.user_id || null,
        event.page_url || null,
        VALID_PAGE_TYPES.has(event.page_type || '') ? event.page_type : 'other',
        event.referrer || null,
        event.product_id || null,
        event.product_title || null,
        event.product_price || null,
        event.category || null,
        event.quantity || null,
        event.search_query || null,
        event.checkout_step || null,
        event.properties ? JSON.stringify(event.properties) : null,
        clientTs,
        ipHash,
        userAgent.substring(0, 500),
        deviceType,
      ]);

      // Extract decision context from properties and write to decision_contexts
      // This happens in real-time as events arrive — not in batch
      if (
        (event.event_type === 'product_view' || event.event_type === 'add_to_cart') &&
        event.product_id &&
        event.properties &&
        typeof event.properties === 'object'
      ) {
        const ctx = event.properties as Record<string, unknown>;
        await query(`
          INSERT INTO decision_contexts (
            event_id, session_id, event_type, product_id, product_price,
            prior_product_views, prior_cart_adds, prior_searches, session_duration_so_far_s,
            prices_seen_before, median_price_seen, min_price_seen, max_price_seen,
            price_rank_in_session, price_vs_median_pct,
            is_most_expensive_seen, is_cheapest_seen,
            time_on_page_before_ms, scroll_depth_pct,
            is_from_search, is_return_view,
            same_category_views_before,
            device_type, hour_of_day, day_of_week,
            client_ts
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
          ) ON CONFLICT DO NOTHING
        `, [
          eventId,
          event.session_id.substring(0, 128),
          event.event_type,
          event.product_id,
          event.product_price || null,
          Number(ctx.prior_product_views ?? 0),
          Number(ctx.prior_cart_adds ?? 0),
          Number(ctx.prior_searches ?? 0),
          Number(ctx.session_duration_so_far_s ?? 0),
          Array.isArray(ctx.prices_seen_before) ? ctx.prices_seen_before : [],
          ctx.median_price_seen || null,
          ctx.min_price_seen || null,
          ctx.max_price_seen || null,
          Number(ctx.price_rank_in_session ?? 1),
          ctx.price_vs_median_pct !== undefined ? Number(ctx.price_vs_median_pct) : null,
          Boolean(ctx.is_most_expensive_seen),
          Boolean(ctx.is_cheapest_seen),
          Number(ctx.time_on_page_before_ms ?? 0),
          Number(ctx.scroll_depth_pct ?? 0),
          Boolean(ctx.is_from_search),
          Boolean(ctx.is_return_view),
          Number(ctx.same_category_views_before ?? 0),
          deviceType,
          new Date(clientTs).getHours(),
          new Date(clientTs).getDay(),
          clientTs,
        ]).catch(() => {}); // non-fatal
      }

      inserted.push(eventId);
    }

    return NextResponse.json({
      success: true,
      inserted: inserted.length,
      errors: errors.length > 0 ? errors : undefined,
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.STOREFRONT_URL || 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('[events] Ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.STOREFRONT_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
