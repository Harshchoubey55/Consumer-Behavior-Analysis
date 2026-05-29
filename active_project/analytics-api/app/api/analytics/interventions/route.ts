import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

// Avoid caching in Next.js App Router for this API
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Aggregate arm stats directly from intervention_logs
    // (No longer depends on the removed causal_bandit_parameters table)
    const armsRes = await query<{
      arm_name: string;
      pulls: number;
      conversions: number;
      empirical_conversion_rate: number;
    }>(`
      SELECT assigned_arm AS arm_name,
             COUNT(*) AS pulls,
             SUM(CASE WHEN outcome = 1 THEN 1 ELSE 0 END) AS conversions,
             ROUND(AVG(CASE WHEN outcome_updated = TRUE THEN outcome::numeric ELSE NULL END) * 100, 2) AS empirical_conversion_rate
      FROM intervention_logs
      GROUP BY assigned_arm
      ORDER BY pulls DESC
    `);

    // Fetch the causal uplift from IPW evaluation
    const upliftRes = await query<{
      intervention: string;
      sample_size: number;
      base_conversion: string;
      treatment_conv: string;
      absolute_uplift: string;
      relative_lift: string;
      p_value: string;
      is_significant: boolean;
      ipw_ate: string;
      notes: string;
    }>(`
      SELECT intervention, sample_size, base_conversion, treatment_conv,
             absolute_uplift, relative_lift, p_value, is_significant, ipw_ate, notes
      FROM causal_uplift_results
      WHERE is_latest = TRUE
      ORDER BY relative_lift DESC
    `);
    
    // Fetch recent intervention logs for debugging/monitoring
    const logsRes = await query<{
      session_id: string;
      assigned_arm: string;
      propensity: string;
      outcome: number;
      created_at: string;
    }>(`
      SELECT session_id, assigned_arm, propensity, outcome, created_at
      FROM intervention_logs
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return NextResponse.json({
      arms: armsRes,
      uplift: upliftRes,
      recentLogs: logsRes
    });
  } catch (error) {
    console.error('Interventions API error:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}
