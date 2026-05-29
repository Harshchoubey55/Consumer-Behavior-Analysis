import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/analytics/phenotypes
 *
 * Returns behavioral phenotype profiles and session assignments.
 * Supports both standard (K-Means on raw features) and federated
 * (K-Means on gradient vectors) phenotypes.
 */
export async function GET() {
  try {
    // ── Standard phenotype profiles ─────────────────────────────────────
    const profilesRes = await query<{
      phenotype_index: number;
      phenotype_name: string;
      archetype_code: string;
      sample_size: number;
      conversion_rate: string;
      avg_prior_views: string;
      avg_price_vs_median: string;
      avg_scroll_depth: string;
      anova_f_stat: string;
      anova_p_value: string;
      anova_significant: boolean;
      silhouette_score: string;
    }>(`
      SELECT
        pp.phenotype_index,
        pp.phenotype_name,
        pp.archetype_code,
        pp.sample_size,
        pp.conversion_rate,
        pp.avg_prior_views,
        pp.avg_price_vs_median,
        pp.avg_scroll_depth,
        pp.anova_f_stat,
        pp.anova_p_value,
        pp.anova_significant,
        pp.silhouette_score
      FROM phenotype_profiles pp
      WHERE pp.run_id = (
        SELECT run_id FROM phenotype_profiles ORDER BY generated_at DESC LIMIT 1
      )
      ORDER BY pp.conversion_rate DESC
    `);

    // ── Drift stats ─────────────────────────────────────────────────────
    const driftRes = await query<{
      drift_type: string;
      count: number;
    }>(`
      SELECT drift_type, COUNT(*) AS count
      FROM user_behavioral_drift
      WHERE drift_detected = TRUE AND drift_type IS NOT NULL
      GROUP BY drift_type
      ORDER BY count DESC
      LIMIT 10
    `);

    // ── Federated phenotypes summary ────────────────────────────────────
    const fedRes = await query<{
      cluster_name: string;
      count: number;
      avg_delta_magnitude: string;
    }>(`
      SELECT
        cluster_name,
        COUNT(*) AS count,
        ROUND(AVG(delta_magnitude), 4) AS avg_delta_magnitude
      FROM federated_phenotypes
      WHERE run_id = (
        SELECT run_id FROM federated_phenotypes ORDER BY assigned_at DESC LIMIT 1
      )
      GROUP BY cluster_name
      ORDER BY count DESC
    `).catch(() => []); // table may not exist yet

    // ── Global model status ─────────────────────────────────────────────
    const globalModelRes = await query<{
      n_rounds: number;
      n_total_samples: number;
      last_updated: string;
    }>(`
      SELECT n_rounds, n_total_samples, last_updated FROM global_model WHERE id = 1
    `).catch(() => []);

    // ── ANOVA metadata from latest run ─────────────────────────────────
    const anovaRes = await query<{
      cluster_k: number;
      anova_f_stat: string;
      anova_p_value: string;
      anova_significant: boolean;
      silhouette_score: string;
    }>(`
      SELECT DISTINCT ON (run_id)
        cluster_k, anova_f_stat, anova_p_value, anova_significant, silhouette_score
      FROM phenotype_profiles
      ORDER BY run_id, generated_at DESC
      LIMIT 1
    `);

    return NextResponse.json({
      profiles: profilesRes,
      drift: driftRes,
      federated: fedRes,
      globalModel: globalModelRes[0] || null,
      anova: anovaRes[0] || null,
    });
  } catch (error) {
    console.error('[phenotypes] API error:', error);
    return NextResponse.json({ error: 'Failed to fetch phenotype data' }, { status: 500 });
  }
}
