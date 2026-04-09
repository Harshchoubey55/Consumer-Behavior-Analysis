import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    const products = await query<{
      product_id: string;
      product_title: string;
      category: string;
      view_count: number;
      unique_viewers: number;
      cart_add_count: number;
      purchase_count: number;
      avg_price: string;
      view_to_cart_rate: string;
      cart_to_purchase_rate: string;
      last_viewed_at: string;
    }>(`
      SELECT
        product_id,
        product_title,
        category,
        view_count,
        unique_viewers,
        cart_add_count,
        purchase_count,
        ROUND(avg_price::NUMERIC, 2)::TEXT AS avg_price,
        ROUND(view_to_cart_rate * 100, 1)::TEXT AS view_to_cart_rate,
        ROUND(cart_to_purchase_rate * 100, 1)::TEXT AS cart_to_purchase_rate,
        TO_CHAR(last_viewed_at, 'YYYY-MM-DD HH24:MI') AS last_viewed_at
      FROM product_analytics
      ORDER BY view_count DESC
    `);

    // Top searched terms
    const searchTerms = await query<{ query: string; count: string }>(`
      SELECT
        search_query AS query,
        COUNT(*)::TEXT AS count
      FROM raw_events
      WHERE event_type = 'search' AND search_query IS NOT NULL
      GROUP BY search_query
      ORDER BY count DESC
      LIMIT 10
    `);

    // Category breakdown
    const categories = await query<{ category: string; views: string; cart_adds: string }>(`
      SELECT
        category,
        SUM(view_count)::TEXT AS views,
        SUM(cart_add_count)::TEXT AS cart_adds
      FROM product_analytics
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY views DESC
    `);

    return NextResponse.json({ products, searchTerms, categories });

  } catch (error) {
    console.error('[analytics/products] Error:', error);
    return NextResponse.json({ error: 'Failed to load product data' }, { status: 500 });
  }
}
