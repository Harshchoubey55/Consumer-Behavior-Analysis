import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const N_FEATURES = 15;

/**
 * GET /api/global-model
 *
 * Returns the current global FedAvg model weights for client-side
 * initialization. The browser's local_model.ts initializes from these
 * weights so that client training starts from the population aggregate,
 * not from random initialization.
 *
 * Returns:
 *   weights:         number[] (15 values, one per decision context feature)
 *   n_rounds:        number   (how many FedAvg aggregation rounds have run)
 *   n_total_samples: number   (cumulative product views across all sessions)
 *   last_updated:    string   (ISO timestamp)
 */
export async function GET() {
  try {
    const rows = await query<{
      weights: string[];
      n_rounds: number;
      n_total_samples: number;
      last_updated: string;
    }>(`SELECT weights, n_rounds, n_total_samples, last_updated FROM global_model WHERE id = 1`);

    if (!rows.length) {
      // Return zero-initialized weights if table is empty (first run)
      return NextResponse.json({
        weights: Array(N_FEATURES).fill(0),
        n_rounds: 0,
        n_total_samples: 0,
        last_updated: null,
      }, {
        headers: {
          'Access-Control-Allow-Origin': process.env.STOREFRONT_URL || '*',
          'Cache-Control': 'public, max-age=300', // cache for 5 minutes
        },
      });
    }

    const row = rows[0];
    return NextResponse.json({
      weights: (row.weights || []).map(Number),
      n_rounds: Number(row.n_rounds),
      n_total_samples: Number(row.n_total_samples),
      last_updated: row.last_updated,
    }, {
      headers: {
        'Access-Control-Allow-Origin': process.env.STOREFRONT_URL || '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('[global-model] Error:', error);
    // Graceful fallback — never break the storefront
    return NextResponse.json({
      weights: Array(N_FEATURES).fill(0),
      n_rounds: 0,
      n_total_samples: 0,
      last_updated: null,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
