import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    // Current funnel from today's snapshot, fallback to live calculation
    const funnel = await query<{
      step_name: string;
      step_order: number;
      session_count: number;
      user_count: number;
    }>(`
      WITH live_funnel AS (
        SELECT step_name, step_order,
               COUNT(DISTINCT session_id) AS session_count,
               COUNT(DISTINCT COALESCE(user_id, session_id)) AS user_count
        FROM (
          SELECT session_id, user_id, 'home'            AS step_name, 1 AS step_order FROM raw_events WHERE page_type = 'home'
          UNION ALL
          SELECT session_id, user_id, 'product_listing', 2 FROM raw_events WHERE page_type = 'plp'
          UNION ALL
          SELECT session_id, user_id, 'product_detail',  3 FROM raw_events WHERE event_type = 'product_view'
          UNION ALL
          SELECT session_id, user_id, 'add_to_cart',     4 FROM raw_events WHERE event_type = 'add_to_cart'
          UNION ALL
          SELECT session_id, user_id, 'checkout_start',  5 FROM raw_events WHERE event_type = 'checkout_step' AND checkout_step = 1
          UNION ALL
          SELECT session_id, user_id, 'purchase',        6 FROM raw_events WHERE event_type = 'purchase'
        ) f
        GROUP BY step_name, step_order
      )
      SELECT * FROM live_funnel ORDER BY step_order
    `);

    // Calculate drop-off rates
    const funnelWithDropoff = funnel.map((step, i) => {
      const prev = i > 0 ? funnel[i - 1] : null;
      const dropoffRate = prev && prev.user_count > 0
        ? Math.round((1 - step.user_count / prev.user_count) * 100 * 10) / 10
        : 0;
      const retentionRate = prev && prev.user_count > 0
        ? Math.round((step.user_count / prev.user_count) * 100 * 10) / 10
        : 100;
      return { ...step, dropoff_rate: dropoffRate, retention_rate: retentionRate };
    });

    // Historical funnel (last 7 days)
    const historical = await query<{
      snapshot_date: string;
      step_name: string;
      user_count: number;
    }>(`
      SELECT
        TO_CHAR(snapshot_date, 'Mon DD') AS snapshot_date,
        step_name,
        user_count
      FROM funnel_snapshots
      WHERE snapshot_date >= CURRENT_DATE - 7
      ORDER BY snapshot_date ASC, step_order ASC
    `);

    // Checkout step analysis
    const checkoutSteps = await query<{
      step: number;
      users: number;
      label: string;
    }>(`
      SELECT
        checkout_step AS step,
        COUNT(DISTINCT session_id) AS users,
        CASE checkout_step
          WHEN 1 THEN 'Address'
          WHEN 2 THEN 'Shipping'
          WHEN 3 THEN 'Payment'
          WHEN 4 THEN 'Complete'
          ELSE 'Unknown'
        END AS label
      FROM raw_events
      WHERE event_type IN ('checkout_step', 'purchase') AND checkout_step IS NOT NULL
      GROUP BY checkout_step
      ORDER BY checkout_step
    `);

    return NextResponse.json({ funnel: funnelWithDropoff, historical, checkoutSteps });

  } catch (error) {
    console.error('[analytics/funnel] Error:', error);
    return NextResponse.json({ error: 'Failed to load funnel data' }, { status: 500 });
  }
}
