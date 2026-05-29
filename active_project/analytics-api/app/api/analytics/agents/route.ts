import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/analytics/agents
 *
 * Returns the status of all pipeline agents from the most recent run.
 * Powers the /agents dashboard page showing real-time pipeline health.
 *
 * Returns:
 *   - latestRun: metadata about the most recent orchestrator run
 *   - agents: per-agent status, timing, and health metrics
 *   - history: last 5 run summaries for trend visualization
 */
export async function GET() {
  try {
    // ── Most recent run ID ──────────────────────────────────────────────
    const latestRunRes = await query<{ run_id: string; created_at: string; pipeline_mode: string }>(`
      SELECT run_id, pipeline_mode, MIN(created_at) AS created_at
      FROM agent_runs
      GROUP BY run_id, pipeline_mode
      ORDER BY MIN(created_at) DESC
      LIMIT 1
    `);

    if (!latestRunRes.length) {
      return NextResponse.json({ agents: [], latestRun: null, history: [] });
    }

    const { run_id: latestRunId } = latestRunRes[0];

    // ── Per-agent status for latest run ────────────────────────────────
    const agentsRes = await query<{
      agent_name: string;
      agent_version: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      duration_ms: number | null;
      rows_processed: number | null;
      error_message: string | null;
      health_checks: string | null;
    }>(`
      SELECT
        agent_name,
        agent_version,
        status,
        started_at,
        completed_at,
        duration_ms,
        rows_processed,
        error_message,
        health_checks::text AS health_checks
      FROM agent_runs
      WHERE run_id = $1
      ORDER BY COALESCE(started_at, created_at) ASC
    `, [latestRunId]);

    // ── Run history (last 7 runs) ───────────────────────────────────────
    const historyRes = await query<{
      run_id: string;
      pipeline_mode: string;
      started_at: string;
      total_agents: number;
      completed: number;
      failed: number;
      skipped: number;
      total_duration_ms: number;
    }>(`
      SELECT
        run_id,
        pipeline_mode,
        MIN(started_at) AS started_at,
        COUNT(*) AS total_agents,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'FAILED'    THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'SKIPPED'   THEN 1 ELSE 0 END) AS skipped,
        COALESCE(MAX(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000), 0)::INTEGER AS total_duration_ms
      FROM agent_runs
      WHERE started_at IS NOT NULL
      GROUP BY run_id, pipeline_mode
      ORDER BY MIN(started_at) DESC
      LIMIT 7
    `);

    return NextResponse.json({
      latestRun: latestRunRes[0],
      agents: agentsRes.map(a => ({
        ...a,
        health_checks: a.health_checks ? JSON.parse(a.health_checks) : null,
      })),
      history: historyRes,
    });
  } catch (error) {
    console.error('[agents] API error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent status' }, { status: 500 });
  }
}
