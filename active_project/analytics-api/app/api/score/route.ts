import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '../../../lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/score
 *
 * Real-time in-session risk scoring.
 * Called by the storefront tracker as events accumulate in a session.
 *
 * This is the key differentiator: scoring happens DURING the session,
 * not after it ends. The score is based on the sequence of events
 * seen so far — not just aggregate counts.
 *
 * Body: {
 *   session_id: string,
 *   event_sequence: string[],   // ordered canonical state names
 *   timing_deltas_ms: number[], // ms between events
 * }
 *
 * Returns: {
 *   risk_score: number,         // 0 (safe) to 1 (high abandonment risk)
 *   risk_tier: string,          // low | medium | high | critical
 *   current_state: string,
 *   conversion_probability: number,
 *   explanation: string,
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

// ─── Causal Bandit Interventions ────────────────────────

let banditCache: { A: number[][][], b: number[][][], arms: string[] } | null = null;
let banditCacheTime = 0;

async function getBanditParams() {
   const now = Date.now();
   if (banditCache && (now - banditCacheTime) < CACHE_TTL_MS) return banditCache;
   try {
     const rows = await query<{ arm_id: number; arm_name: string; a_matrix_json: string; b_vector_json: string }>(
       `SELECT * FROM causal_bandit_parameters ORDER BY arm_id`
     );
     if (rows.length === 0) return null;
     const A: number[][][] = [];
     const b: number[][][] = [];
     const arms: string[] = [];
     for (const r of rows) {
       A[r.arm_id] = JSON.parse(r.a_matrix_json);
       b[r.arm_id] = JSON.parse(r.b_vector_json);
       arms[r.arm_id] = r.arm_name;
     }
     banditCache = { A, b, arms };
     banditCacheTime = now;
     return banditCache;
   } catch { return null; }
}

function invertMatrix(M: number[][]): number[][] {
    // Simple 2x2 or generic inverse using Gauss-Jordan is needed, BUT for speed, 
    // we can assume the A matrix is pre-inverted by Python (Python uploads A_inv).
    // Actually, storing A_inv in A_matrix_json from python avoids JS matrix math complexity!
    // Let's assume A contains A_inv.
    return M;
}

function getIntervention(ctx: any, bandit: any): string {
    if (!bandit || !ctx) return 'NONE';
    
    // Feature vector identical to Python
    const vec = [
        ctx.prior_product_views || 0,
        ctx.prior_cart_adds || 0,
        ctx.prior_searches || 0,
        ctx.session_duration_so_far_s || 0,
        ctx.price_rank_in_session || 0,
        ctx.price_vs_median_pct || 0,
        ctx.is_most_expensive_seen ? 1 : 0,
        ctx.is_cheapest_seen ? 1 : 0,
        (ctx.time_on_page_before_ms || 0) / 1000.0,
        (ctx.scroll_depth_pct || 0) / 100.0,
        ctx.scroll_velocity_avg || 0,
        ctx.micro_hesitations || 0,
        ctx.same_category_views_before || 0,
        ctx.is_return_view ? 1 : 0,
        ctx.is_from_search ? 1 : 0
    ];
    
    const alpha = 0.1;
    let maxP = -Infinity;
    let bestArm = 0;
    
    for (let i = 0; i < bandit.arms.length; i++) {
        const A_inv = bandit.A[i]; // we assume Python writes A_inv to a_matrix_json
        const theta = matrixVectorMultiply(A_inv, bandit.b[i]);
        const expectedReward = dotProduct(theta, vec);
        
        // Context uncertainty: vec^T * A_inv * vec
        const quadForm = dotProduct(matrixVectorMultiply(A_inv, vec), vec);
        const p = expectedReward + alpha * Math.sqrt(Math.abs(quadForm));
        
        if (p > maxP) {
            maxP = p;
            bestArm = i;
        }
    }
    
    return bandit.arms[bestArm] || 'NONE';
}

function matrixVectorMultiply(mat: number[][], vec: number[] | number[][]): number[] {
    const v = Array.isArray(vec[0]) ? (vec as number[][]).map(r => r[0]) : vec as number[];
    return mat.map(row => row.reduce((sum, val, j) => sum + val * (v[j] || 0), 0));
}

function dotProduct(v1: number[], v2: number[]): number {
    return v1.reduce((sum, val, i) => sum + val * (v2[i] || 0), 0);
}

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

    // Calculate Real-Time Causal Intervention!
    let intervention = 'NONE';
    if (latest_context) {
        try {
            const bandit = await getBanditParams();
            intervention = getIntervention(latest_context, bandit);
        } catch (e) {
            console.error('Bandit failed', e);
        }
    }
    
    // Merge intervention into result
    const finalResult = { ...result, intervention };

    // Log to DB asynchronously (don't await — don't block response)
    if (session_id) {
      query(`
        INSERT INTO session_risk_log (session_id, risk_score, risk_tier, sequence_so_far, scored_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [session_id, finalResult.risk_score, finalResult.risk_tier, deduped]).catch(() => {});
      
      if (intervention !== 'NONE') {
         query(`
            INSERT INTO intervention_logs (session_id, context_features, chosen_arm)
            VALUES ($1, $2, $3)
         `, [session_id, latest_context, intervention]).catch(() => {});
      }
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
