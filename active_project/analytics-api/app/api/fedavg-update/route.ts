import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/fedavg-update
 *
 * Receives a sparse gradient delta (Δw = w_local - w_global) from the
 * storefront's client-side local model and stores it for FedAvg aggregation.
 *
 * Body: {
 *   session_id:    string,
 *   n_samples:     number,   // number of product views in session
 *   delta_indices: number[], // sparse: which of the 15 features changed
 *   delta_values:  number[], // sparse: the change values
 * }
 *
 * The Python FedAvgAgent picks up rows where applied=FALSE on each pipeline run.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, n_samples, delta_indices, delta_values } = body;

    if (!session_id || !Array.isArray(delta_indices) || !Array.isArray(delta_values)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (delta_indices.length === 0 || delta_indices.length !== delta_values.length) {
      return NextResponse.json({ error: 'delta_indices and delta_values must be non-empty and equal length' }, { status: 400 });
    }

    // Validate: indices in range [0, 14], values are numbers
    const clean_indices = delta_indices.map(Number).filter(i => i >= 0 && i < 15);
    const clean_values  = delta_values.map(Number).filter(v => isFinite(v) && Math.abs(v) < 10);

    if (clean_indices.length === 0) {
      return NextResponse.json({ ok: true, note: 'No valid indices — update not stored.' });
    }

    await query(`
      INSERT INTO fedavg_updates (session_id, n_samples, delta_indices, delta_values)
      VALUES ($1, $2, $3, $4)
    `, [
      session_id,
      Math.min(Math.max(1, Number(n_samples) || 1), 1000),
      clean_indices,
      clean_values,
    ]);

    return NextResponse.json({ ok: true, stored: clean_indices.length });
  } catch (error) {
    console.error('[fedavg-update] Error:', error);
    return NextResponse.json({ error: 'Failed to store update' }, { status: 500 });
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
