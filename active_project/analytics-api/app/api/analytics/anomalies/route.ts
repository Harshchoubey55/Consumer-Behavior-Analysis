import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/analytics/anomalies
 *
 * Returns sessions whose Markov path log-probability is ≥2 standard
 * deviations below the mean — statistically improbable behavioral paths.
 *
 * These are interesting for three reasons:
 *   1. UX bugs: confused users who can't find what they want
 *   2. Behavioral outliers: unusual decision-making worth studying
 *   3. Data quality: bot traffic or tracking instrumentation errors
 */
export async function GET() {
  try {
    const anomaliesRes = await query<{
      session_id: string;
      sequence_length: number;
      log_probability: string;
      z_score: string;
      anomaly_type: string;
      path_signature: string;
      converted: boolean;
      flagged_at: string;
    }>(`
      SELECT
        session_id,
        sequence_length,
        log_probability,
        z_score,
        anomaly_type,
        path_signature,
        converted,
        flagged_at
      FROM session_anomalies
      ORDER BY z_score ASC
      LIMIT 100
    `);

    // ── Summary stats ───────────────────────────────────────────────────
    const summaryRes = await query<{
      total_flagged: number;
      converted_count: number;
      avg_z_score: string;
      most_common_type: string;
    }>(`
      SELECT
        COUNT(*) AS total_flagged,
        SUM(CASE WHEN converted THEN 1 ELSE 0 END) AS converted_count,
        ROUND(AVG(z_score), 4) AS avg_z_score,
        (
          SELECT anomaly_type FROM session_anomalies
          GROUP BY anomaly_type ORDER BY COUNT(*) DESC LIMIT 1
        ) AS most_common_type
      FROM session_anomalies
    `);

    // ── Type breakdown ──────────────────────────────────────────────────
    const typeBreakdownRes = await query<{
      anomaly_type: string;
      count: number;
      converted_count: number;
    }>(`
      SELECT
        anomaly_type,
        COUNT(*) AS count,
        SUM(CASE WHEN converted THEN 1 ELSE 0 END) AS converted_count
      FROM session_anomalies
      GROUP BY anomaly_type
      ORDER BY count DESC
    `);

    return NextResponse.json({
      anomalies: anomaliesRes,
      summary: summaryRes[0] || null,
      typeBreakdown: typeBreakdownRes,
    });
  } catch (error) {
    console.error('[anomalies] API error:', error);
    return NextResponse.json({ error: 'Failed to fetch anomaly data' }, { status: 500 });
  }
}
