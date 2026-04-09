import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    const recommendations = await query<{
      rec_id: string;
      category: string;
      severity: string;
      title: string;
      description: string;
      affected_entity: string | null;
      metric_value: string;
      metric_label: string;
      action_suggested: string;
      generated_at: string;
    }>(`
      SELECT
        rec_id::TEXT,
        category,
        severity,
        title,
        description,
        affected_entity,
        ROUND(metric_value::NUMERIC, 4)::TEXT AS metric_value,
        metric_label,
        action_suggested,
        TO_CHAR(generated_at, 'Mon DD, HH24:MI') AS generated_at
      FROM recommendations
      WHERE is_active = TRUE
      ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
        generated_at DESC
    `);

    const summary = await query<{ category: string; count: string; critical_count: string }>(`
      SELECT
        category,
        COUNT(*)::TEXT AS count,
        COUNT(*) FILTER (WHERE severity = 'critical')::TEXT AS critical_count
      FROM recommendations
      WHERE is_active = TRUE
      GROUP BY category
    `);

    return NextResponse.json({ recommendations, summary });

  } catch (error) {
    console.error('[analytics/recommendations] Error:', error);
    return NextResponse.json({ error: 'Failed to load recommendations' }, { status: 500 });
  }
}
