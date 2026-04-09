import { NextResponse } from 'next/server';
import { query, queryOne } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    // Overall KPIs
    const kpis = await queryOne<{
      total_sessions: string;
      unique_users: string;
      total_events: string;
      total_purchases: string;
      avg_session_duration: string;
      bounce_rate: string;
      conversion_rate: string;
      cart_abandonment_rate: string;
    }>(`
      SELECT
        COUNT(DISTINCT session_id)::TEXT AS total_sessions,
        COUNT(DISTINCT COALESCE(user_id, session_id))::TEXT AS unique_users,
        COUNT(*)::TEXT AS total_events,
        COUNT(*) FILTER (WHERE event_type = 'purchase')::TEXT AS total_purchases,
        ROUND(AVG(EXTRACT(EPOCH FROM (
          MAX(client_ts) OVER (PARTITION BY session_id) -
          MIN(client_ts) OVER (PARTITION BY session_id)
        )))::NUMERIC, 1)::TEXT AS avg_session_duration,
        '0' AS bounce_rate,
        '0' AS conversion_rate,
        '0' AS cart_abandonment_rate
      FROM raw_events
      WHERE server_ts >= NOW() - INTERVAL '30 days'
    `);

    // Get aggregated rates from sessions
    const rates = await queryOne<{
      bounce_rate: string;
      conversion_rate: string;
      cart_abandonment_rate: string;
      avg_duration: string;
    }>(`
      SELECT
        ROUND(AVG(CASE WHEN is_bounce THEN 1.0 ELSE 0.0 END) * 100, 1)::TEXT AS bounce_rate,
        ROUND(AVG(CASE WHEN converted THEN 1.0 ELSE 0.0 END) * 100, 2)::TEXT AS conversion_rate,
        ROUND(
          (1.0 - SUM(CASE WHEN converted THEN 1.0 ELSE 0.0 END) /
          NULLIF(SUM(CASE WHEN cart_add_count > 0 THEN 1.0 ELSE 0.0 END), 0)) * 100, 1
        )::TEXT AS cart_abandonment_rate,
        ROUND(AVG(duration_seconds)::NUMERIC, 0)::TEXT AS avg_duration
      FROM sessions
      WHERE started_at >= NOW() - INTERVAL '30 days'
    `);

    // Daily trend (last 14 days)
    const trend = await query<{
      date: string;
      sessions: string;
      users: string;
      events: string;
      conversions: string;
    }>(`
      SELECT
        TO_CHAR(kpi_date, 'Mon DD') AS date,
        total_sessions::TEXT AS sessions,
        unique_users::TEXT AS users,
        total_events::TEXT AS events,
        ROUND(conversion_rate * total_sessions)::TEXT AS conversions
      FROM daily_kpis
      ORDER BY kpi_date DESC
      LIMIT 14
    `);

    // Device breakdown
    const devices = await query<{ device_type: string; count: string }>(`
      SELECT
        COALESCE(device_type, 'unknown') AS device_type,
        COUNT(DISTINCT session_id)::TEXT AS count
      FROM raw_events
      WHERE server_ts >= NOW() - INTERVAL '30 days'
      GROUP BY device_type
      ORDER BY count DESC
    `);

    // User engagement distribution
    const engagement = await query<{ tier: string; count: string }>(`
      SELECT engagement_tier AS tier, COUNT(*)::TEXT AS count
      FROM user_features
      GROUP BY engagement_tier
      ORDER BY
        CASE engagement_tier WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `);

    // Churn risk distribution
    const churn = await query<{ risk: string; count: string; avg_prob: string }>(`
      SELECT
        churn_risk AS risk,
        COUNT(*)::TEXT AS count,
        ROUND(AVG(churn_probability) * 100, 1)::TEXT AS avg_prob
      FROM user_features
      GROUP BY churn_risk
      ORDER BY
        CASE churn_risk WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `);

    return NextResponse.json({
      kpis: {
        total_sessions: parseInt(kpis?.total_sessions || '0'),
        unique_users: parseInt(kpis?.unique_users || '0'),
        total_events: parseInt(kpis?.total_events || '0'),
        total_purchases: parseInt(kpis?.total_purchases || '0'),
        avg_session_duration: parseInt(rates?.avg_duration || '0'),
        bounce_rate: parseFloat(rates?.bounce_rate || '0'),
        conversion_rate: parseFloat(rates?.conversion_rate || '0'),
        cart_abandonment_rate: parseFloat(rates?.cart_abandonment_rate || '0'),
      },
      trend: trend.reverse(),
      devices,
      engagement,
      churn,
    });

  } catch (error) {
    console.error('[analytics/summary] Error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
