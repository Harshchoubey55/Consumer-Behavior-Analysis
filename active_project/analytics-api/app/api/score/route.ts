import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '../../../lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/score
 *
 * Real-time in-session risk scoring + randomized intervention assignment.
 * Called by the storefront tracker as events accumulate in a session.
 *
 * Body: {
 *   session_id: string,
 *   event_sequence: string[],
 *   timing_deltas_ms: number[],
 *   raw_events?: { event_type: string; page_type?: string }[],
 *   latest_context?: object,
 * }
 *
 * Returns: {
 *   risk_score: number,
 *   risk_tier: string,
 *   current_state: string,
 *   conversion_probability: number,
 *   explanation: string,
 *   intervention: string,  // NONE | COMPARE_MATRIX | PRICE_REFRAME
 * }
 */

// State normalization map (mirrors Python STATE_MAP)
const STATE_MAP: Record<string, string> = {
  'page_view:home':     'HOME',
  'page_view:plp':      'BROWSE',
  'page_view:pdp':      'VIEW_PRODUCT',
  'page_view:cart':     'VIEW_CART',
  'page_view:checkout': 'CHECKOUT',
  'product_view':       'VIEW_PRODUCT',
  'add_to_cart':        'ADD_CART',
  'remove_from_cart':   'REMOVE_CART',
  'search':             'SEARCH',
  'checkout_step':      'CHECKOUT',
  'purchase':           'PURCHASE',
};

function eventToState(eventType: string, pageType?: string): string {
  const key = pageType ? `${eventType}:${pageType}` : eventType;
  return STATE_MAP[key] || STATE_MAP[eventType] || `OTHER:${eventType}`;
}

// In-memory Markov matrix cache (refreshed every 5 minutes)
let matrixCache: Record<string, Record<string, number>> | null = null;
let convRateCache: Record<string, Record<string, number>> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getMatrix() {
  const now = Date.now();
  if (matrixCache && (now - cacheTime) < CACHE_TTL_MS) {
    return { matrix: matrixCache, convRates: convRateCache! };
  }

  const rows = await query<{
    from_state: string;
    to_state: string;
    transition_prob: string;
    conversion_rate: string;
  }>(`
    SELECT from_state, to_state, transition_prob, conversion_rate
    FROM markov_transitions
    WHERE from_state NOT IN ('__START__', '__END__')
  `);

  const matrix: Record<string, Record<string, number>> = {};
  const convRates: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    if (!matrix[row.from_state]) matrix[row.from_state] = {};
    if (!convRates[row.from_state]) convRates[row.from_state] = {};
    matrix[row.from_state][row.to_state] = parseFloat(row.transition_prob);
    convRates[row.from_state][row.to_state] = parseFloat(row.conversion_rate);
  }

  matrixCache = matrix;
  convRateCache = convRates;
  cacheTime = now;

  return { matrix, convRates };
}

// ─── Fixed-Probability Intervention Assignment ─────────────────────
// A/B/C test with known propensities (makes IPW valid)
// NONE = 50%, COMPARE_MATRIX = 25%, PRICE_REFRAME = 25%

function assignArm(): { arm: string; propensity: number } {
  const r = Math.random();
  if (r < 0.50) return { arm: 'NONE', propensity: 0.50 };
  if (r < 0.75) return { arm: 'COMPARE_MATRIX', propensity: 0.25 };
  return { arm: 'PRICE_REFRAME', propensity: 0.25 };
}

// ─── Markov Forward Conversion Probability ────────────────────────

function computeConversionProbability(
  currentState: string,
  matrix: Record<string, Record<string, number>>,
  depth: number = 5
): number {
  if (currentState === 'PURCHASE') return 1.0;
  if (currentState === '__END__' || depth === 0) return 0.0;

  const transitions = matrix[currentState] || {};
  const entries = Object.entries(transitions);
  if (entries.length === 0) return 0.05;

  const total = entries.reduce((s, [, p]) => s + p, 0);
  if (total <= 0) return 0.05;

  let expectedConv = 0;
  for (const [nextState, prob] of entries) {
    const normalizedProb = prob / total;
    expectedConv += normalizedProb * computeConversionProbability(nextState, matrix, depth - 1);
  }

  return expectedConv;
}

function scoreSequence(
  sequence: string[],
  timingDeltas: number[],
  matrix: Record<string, Record<string, number>>,
  convRates: Record<string, Record<string, number>>
): {
  risk_score: number;
  risk_tier: string;
  current_state: string;
  conversion_probability: number;
  explanation: string;
} {
  if (!sequence.length) {
    return {
      risk_score: 0.5, risk_tier: 'medium',
      current_state: 'unknown',
      conversion_probability: 0.5,
      explanation: 'No events yet',
    };
  }

  const currentState = sequence[sequence.length - 1];

  // Base conversion probability from Markov forward pass
  let convProb = computeConversionProbability(currentState, matrix, 5);

  // Path-based adjustment: use conversion rate on the last edge traversed
  if (sequence.length >= 2) {
    const prevState = sequence[sequence.length - 2];
    const edgeConvRate = convRates[prevState]?.[currentState] ?? convProb;
    convProb += (edgeConvRate - convProb) * 0.3;
  }

  // Timing adjustment
  let timingAdj = 0;
  const lastDelta = timingDeltas[timingDeltas.length - 1] ?? 0;
  if (lastDelta > 120_000) timingAdj = -0.15;
  else if (lastDelta > 60_000) timingAdj = -0.07;

  // Loop detection
  let loopAdj = 0;
  if (sequence.length >= 3) {
    const last3 = sequence.slice(-3);
    if (new Set(last3).size === 1) loopAdj = -0.2;
    else if (sequence.slice(0, -1).includes(currentState)) loopAdj = -0.08;
  }

  convProb = Math.max(0.01, Math.min(0.99, convProb + timingAdj + loopAdj));
  const riskScore = 1.0 - convProb;

  const riskTier =
    riskScore > 0.82 ? 'critical' :
    riskScore > 0.65 ? 'high' :
    riskScore > 0.40 ? 'medium' : 'low';

  const parts: string[] = [];
  if (loopAdj < -0.1) parts.push('Navigation loop detected');
  if (timingAdj < -0.1) parts.push('Long dwell on current step');
  if (['VIEW_CART', 'CHECKOUT'].includes(currentState) && riskScore > 0.6) {
    parts.push('High abandonment probability at checkout stage');
  }

  return {
    risk_score: Math.round(riskScore * 10000) / 10000,
    risk_tier: riskTier,
    current_state: currentState,
    conversion_probability: Math.round(convProb * 10000) / 10000,
    explanation: parts.join('; ') || `Scoring ${sequence.length}-step sequence`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, event_sequence, timing_deltas_ms, raw_events, latest_context } = body;

    // Accept either pre-processed state sequences or raw events
    let states: string[] = event_sequence || [];
    if (!states.length && raw_events?.length) {
      states = raw_events.map((e: { event_type: string; page_type?: string }) =>
        eventToState(e.event_type, e.page_type)
      );
    }

    // De-duplicate consecutive identical states
    const deduped: string[] = [];
    for (const s of states) {
      if (!deduped.length || deduped[deduped.length - 1] !== s) {
        deduped.push(s);
      }
    }

    if (!deduped.length) {
      return NextResponse.json({
        risk_score: 0.3, risk_tier: 'low',
        current_state: 'HOME',
        conversion_probability: 0.7,
        intervention: 'NONE',
      });
    }

    let result;
    try {
      const { matrix, convRates } = await getMatrix();
      result = scoreSequence(deduped, timing_deltas_ms || [], matrix, convRates);
    } catch {
      // Fallback heuristic if DB is unavailable
      const lastState = deduped[deduped.length - 1];
      const heuristicRisk: Record<string, number> = {
        'HOME': 0.6, 'BROWSE': 0.55, 'VIEW_PRODUCT': 0.45,
        'ADD_CART': 0.3, 'VIEW_CART': 0.35, 'CHECKOUT': 0.25,
        'PURCHASE': 0.0, 'SEARCH': 0.5,
      };
      const risk = heuristicRisk[lastState] ?? 0.5;
      result = {
        risk_score: risk, risk_tier: risk > 0.6 ? 'high' : 'medium',
        current_state: lastState,
        conversion_probability: 1 - risk,
        explanation: 'Heuristic fallback (Markov matrix unavailable)',
      };
    }

    // ─── Fixed-Probability Randomized Intervention Assignment ───
    const { arm: intervention, propensity } = assignArm();
    
    // Merge intervention into result
    const finalResult = { ...result, intervention };

    // Log to DB asynchronously (don't await — don't block response)
    if (session_id) {
      query(`
        INSERT INTO session_risk_log (session_id, risk_score, risk_tier, sequence_so_far, scored_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [session_id, finalResult.risk_score, finalResult.risk_tier, deduped]).catch(() => {});
      
      // Always log intervention assignment (including NONE for control)
      query(`
        INSERT INTO intervention_logs (session_id, assigned_arm, propensity, context_state)
        VALUES ($1, $2, $3, $4)
      `, [session_id, intervention, propensity, latest_context ? JSON.stringify(latest_context) : null]).catch(() => {});
    }

    return NextResponse.json(finalResult, {
      headers: {
        'Access-Control-Allow-Origin': process.env.STOREFRONT_URL || '*',
        'Cache-Control': 'no-store',
      }
    });

  } catch (error) {
    console.error('[score] Error:', error);
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.STOREFRONT_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
