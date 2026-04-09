import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 120;

export async function GET() {
  try {
    // Markov transition matrix (top transitions by count)
    const transitions = await query<{
      from_state: string;
      to_state: string;
      transition_count: number;
      transition_prob: string;
      conversion_rate: string;
    }>(`
      SELECT
        from_state, to_state,
        transition_count,
        ROUND(transition_prob * 100, 1)::TEXT AS transition_prob,
        ROUND(conversion_rate * 100, 1)::TEXT AS conversion_rate
      FROM markov_transitions
      WHERE from_state NOT IN ('__START__', '__END__')
        AND to_state NOT IN ('__END__')
        AND transition_count >= 2
      ORDER BY transition_count DESC
      LIMIT 40
    `);

    // Unique states for the graph nodes
    const stateSet = new Set<string>();
    transitions.forEach(t => { stateSet.add(t.from_state); stateSet.add(t.to_state); });
    const nodes = Array.from(stateSet).map(s => ({ id: s, label: s.replace('_', ' ') }));

    // Common paths with conversion rates
    const paths = await query<{
      path_signature: string;
      path_array: string[];
      session_count: number;
      conversion_count: number;
      conversion_rate: string;
    }>(`
      SELECT
        path_signature,
        path_array,
        session_count,
        conversion_count,
        ROUND(conversion_rate * 100, 1)::TEXT AS conversion_rate
      FROM common_paths
      ORDER BY session_count DESC
      LIMIT 15
    `);

    // Abandonment heatmap: which states do users most often leave from?
    const abandonmentStates = await query<{ abandoned_at: string; count: string; pct: string }>(`
      SELECT
        abandoned_at,
        COUNT(*)::TEXT AS count,
        ROUND(COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1)::TEXT AS pct
      FROM session_sequences
      WHERE abandoned_at IS NOT NULL AND converted = FALSE
      GROUP BY abandoned_at
      ORDER BY count DESC
      LIMIT 10
    `);

    // Risk score distribution across all scored sessions
    const riskDist = await query<{ tier: string; count: string; avg_risk: string }>(`
      SELECT
        CASE
          WHEN risk_score > 0.82 THEN 'critical'
          WHEN risk_score > 0.65 THEN 'high'
          WHEN risk_score > 0.40 THEN 'medium'
          ELSE 'low'
        END AS tier,
        COUNT(*)::TEXT AS count,
        ROUND(AVG(risk_score) * 100, 1)::TEXT AS avg_risk
      FROM session_sequences
      WHERE risk_score IS NOT NULL
      GROUP BY 1
      ORDER BY MIN(risk_score) DESC
    `);

    // Sequence length distribution
    const seqLengths = await query<{ length: string; sessions: string; conv_rate: string }>(`
      SELECT
        sequence_length::TEXT AS length,
        COUNT(*)::TEXT AS sessions,
        ROUND(AVG(CASE WHEN converted THEN 1.0 ELSE 0.0 END) * 100, 1)::TEXT AS conv_rate
      FROM session_sequences
      WHERE sequence_length <= 12
      GROUP BY sequence_length
      ORDER BY sequence_length
    `);

    // Average timing deltas by state transition (engagement heatmap)
    const timingByState = await query<{
      state: string;
      avg_events: string;
      conversion_sessions: string;
      total_sessions: string;
    }>(`
      SELECT
        abandoned_at AS state,
        ROUND(AVG(sequence_length), 1)::TEXT AS avg_events,
        SUM(CASE WHEN converted THEN 1 ELSE 0 END)::TEXT AS conversion_sessions,
        COUNT(*)::TEXT AS total_sessions
      FROM session_sequences
      WHERE abandoned_at IS NOT NULL
      GROUP BY abandoned_at
      ORDER BY total_sessions DESC
      LIMIT 8
    `);

    return NextResponse.json({
      nodes,
      transitions,
      paths,
      abandonmentStates,
      riskDist,
      seqLengths,
      timingByState,
    });

  } catch (error) {
    console.error('[analytics/paths] Error:', error);
    return NextResponse.json({ error: 'Failed to load path data' }, { status: 500 });
  }
}
