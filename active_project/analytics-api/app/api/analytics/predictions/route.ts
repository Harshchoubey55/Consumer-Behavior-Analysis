import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    // Churn risk distribution with details
    const churnBuckets = await query<{
      bucket: string;
      count: string;
      avg_days_since_last: string;
      avg_sessions: string;
    }>(`
      SELECT
        churn_risk AS bucket,
        COUNT(*)::TEXT AS count,
        ROUND(AVG(days_since_last))::TEXT AS avg_days_since_last,
        ROUND(AVG(session_count), 1)::TEXT AS avg_sessions
      FROM user_features
      GROUP BY churn_risk
      ORDER BY CASE churn_risk WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `);

    // Churn probability histogram (buckets of 10%)
    const churnHistogram = await query<{ bucket: string; count: string }>(`
      SELECT
        (FLOOR(churn_probability * 10) * 10)::TEXT || '–' ||
        (FLOOR(churn_probability * 10) * 10 + 10)::TEXT || '%' AS bucket,
        COUNT(*)::TEXT AS count
      FROM user_features
      GROUP BY FLOOR(churn_probability * 10)
      ORDER BY FLOOR(churn_probability * 10)
    `);

    // Engagement score distribution
    const engagementDist = await query<{ tier: string; count: string; avg_score: string }>(`
      SELECT
        engagement_tier AS tier,
        COUNT(*)::TEXT AS count,
        ROUND(AVG(engagement_score) * 100, 1)::TEXT AS avg_score
      FROM user_features
      GROUP BY engagement_tier
      ORDER BY CASE engagement_tier WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `);

    // Predicted high-value users (high engagement, low churn)
    const highValueUsers = await query<{
      user_id: string;
      session_count: string;
      total_purchases: string;
      engagement_score: string;
      churn_probability: string;
    }>(`
      SELECT
        user_id,
        session_count::TEXT,
        total_purchases::TEXT,
        ROUND(engagement_score * 100, 1)::TEXT AS engagement_score,
        ROUND(churn_probability * 100, 1)::TEXT AS churn_probability
      FROM user_features
      WHERE engagement_tier = 'high' AND churn_risk = 'low'
      ORDER BY engagement_score DESC, total_purchases DESC
      LIMIT 10
    `);

    // At-risk users (high churn, previously engaged)
    const atRiskUsers = await query<{
      user_id: string;
      days_since_last: string;
      session_count: string;
      total_purchases: string;
      churn_probability: string;
    }>(`
      SELECT
        user_id,
        days_since_last::TEXT,
        session_count::TEXT,
        total_purchases::TEXT,
        ROUND(churn_probability * 100, 1)::TEXT AS churn_probability
      FROM user_features
      WHERE churn_risk = 'high' AND (total_purchases > 0 OR total_cart_adds > 2)
      ORDER BY churn_probability DESC
      LIMIT 10
    `);

    // RFM quadrant data (recency vs frequency)
    const rfmData = await query<{
      user_id: string;
      recency_score: string;
      frequency_score: string;
      engagement_score: string;
      churn_risk: string;
    }>(`
      SELECT
        user_id,
        ROUND(recency_score * 100)::TEXT AS recency_score,
        ROUND(frequency_score * 100)::TEXT AS frequency_score,
        ROUND(engagement_score * 100)::TEXT AS engagement_score,
        churn_risk
      FROM user_features
      ORDER BY RANDOM()
      LIMIT 200
    `);

    return NextResponse.json({
      churnBuckets,
      churnHistogram,
      engagementDist,
      highValueUsers,
      atRiskUsers,
      rfmData,
    });

  } catch (error) {
    console.error('[analytics/predictions] Error:', error);
    return NextResponse.json({ error: 'Failed to load predictions' }, { status: 500 });
  }
}
