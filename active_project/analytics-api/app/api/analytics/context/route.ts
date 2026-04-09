import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 120;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');

  try {
    // ── Global context insights (most impactful across all products) ──
    const insights = await query<{
      insight_id: string;
      product_id: string;
      product_title: string;
      insight_type: string;
      severity: string;
      title: string;
      finding: string;
      evidence: string;
      action: string;
      high_context: string;
      low_context: string;
      high_rate: string;
      low_rate: string;
      rate_difference: string;
      relative_lift: string;
      sample_size: number;
      generated_at: string;
    }>(`
      SELECT
        insight_id::TEXT, product_id, product_title, insight_type, severity,
        title, finding, evidence, action,
        high_context, low_context,
        ROUND(high_rate * 100, 1)::TEXT AS high_rate,
        ROUND(low_rate  * 100, 1)::TEXT AS low_rate,
        ROUND(rate_difference * 100, 1)::TEXT AS rate_difference,
        ROUND(relative_lift, 2)::TEXT AS relative_lift,
        sample_size,
        TO_CHAR(generated_at, 'Mon DD HH24:MI') AS generated_at
      FROM context_insights
      WHERE is_active = TRUE
        ${productId ? 'AND product_id = $1' : ''}
      ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
        relative_lift DESC
      LIMIT 40
    `, productId ? [productId] : []);

    // ── Conditional rate heatmap data ──
    // For each product × context dimension, get all bins
    const heatmap = await query<{
      product_id: string;
      product_title: string;
      context_dimension: string;
      bin_label: string;
      bin_order: number;
      view_count: number;
      conversion_rate: string;
      baseline_rate: string;
      lift: string;
      is_significant: boolean;
    }>(`
      SELECT
        product_id, product_title, context_dimension,
        bin_label, bin_order, view_count,
        ROUND(conversion_rate * 100, 1)::TEXT AS conversion_rate,
        ROUND(baseline_rate   * 100, 1)::TEXT AS baseline_rate,
        ROUND(lift, 2)::TEXT AS lift,
        is_significant
      FROM context_conditional_rates
      WHERE view_count >= 3
        ${productId ? 'AND product_id = $1' : ''}
      ORDER BY product_id, context_dimension, bin_order
    `, productId ? [productId] : []);

    // ── Insight type distribution ──
    const insightTypeDist = await query<{ insight_type: string; count: string; avg_lift: string }>(`
      SELECT
        insight_type,
        COUNT(*)::TEXT AS count,
        ROUND(AVG(relative_lift), 2)::TEXT AS avg_lift
      FROM context_insights
      WHERE is_active = TRUE
      GROUP BY insight_type
      ORDER BY AVG(relative_lift) DESC
    `);

    // ── Most context-sensitive products ──
    const contextSensitiveProducts = await query<{
      product_id: string;
      product_title: string;
      insight_count: string;
      max_lift: string;
      max_rate_diff: string;
      severities: string;
    }>(`
      SELECT
        product_id,
        MAX(product_title) AS product_title,
        COUNT(*)::TEXT AS insight_count,
        ROUND(MAX(relative_lift), 2)::TEXT AS max_lift,
        ROUND(MAX(rate_difference) * 100, 1)::TEXT AS max_rate_diff,
        STRING_AGG(DISTINCT severity, ',') AS severities
      FROM context_insights
      WHERE is_active = TRUE
      GROUP BY product_id
      ORDER BY MAX(relative_lift) DESC
      LIMIT 10
    `);

    // ── Context dimension effectiveness summary ──
    // Which dimensions produce the most significant findings?
    const dimensionSummary = await query<{
      context_dimension: string;
      significant_products: string;
      avg_max_lift: string;
      total_observations: string;
    }>(`
      SELECT
        context_dimension,
        COUNT(DISTINCT product_id) FILTER (WHERE is_significant)::TEXT AS significant_products,
        ROUND(AVG(lift) FILTER (WHERE is_significant AND lift > 1), 2)::TEXT AS avg_max_lift,
        SUM(view_count)::TEXT AS total_observations
      FROM context_conditional_rates
      WHERE view_count >= 3
      GROUP BY context_dimension
      ORDER BY AVG(lift) FILTER (WHERE is_significant AND lift > 1) DESC NULLS LAST
    `);

    // ── Session context distribution ──
    // What does the typical decision context look like across all sessions?
    const sessionContextDist = await query<{
      metric: string;
      avg_value: string;
      p25: string;
      p75: string;
    }>(`
      SELECT
        'Avg products viewed before decision' AS metric,
        ROUND(AVG(avg_prior_views_at_decision), 1)::TEXT AS avg_value,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_prior_views_at_decision)::TEXT AS p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_prior_views_at_decision)::TEXT AS p75
      FROM session_context_summary
      UNION ALL
      SELECT
        'Avg price position vs. median (%)',
        ROUND(AVG(avg_price_vs_median_pct), 1)::TEXT,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_price_vs_median_pct), 1)::TEXT,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_price_vs_median_pct), 1)::TEXT
      FROM session_context_summary
      UNION ALL
      SELECT
        'Avg scroll depth (%)',
        ROUND(AVG(avg_scroll_depth_pct), 1)::TEXT,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_scroll_depth_pct), 1)::TEXT,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_scroll_depth_pct), 1)::TEXT
      FROM session_context_summary
    `);

    return NextResponse.json({
      insights,
      heatmap,
      insightTypeDist,
      contextSensitiveProducts,
      dimensionSummary,
      sessionContextDist,
    });

  } catch (error) {
    console.error('[analytics/context] Error:', error);
    return NextResponse.json({ error: 'Failed to load context data' }, { status: 500 });
  }
}
