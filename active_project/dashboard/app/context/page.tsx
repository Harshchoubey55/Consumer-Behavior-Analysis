import ContextClient from '../../components/charts/context-client';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Decision Context' };
export const revalidate = 120;

const API = process.env.ANALYTICS_API_URL || 'http://localhost:3001';

async function getData() {
  try {
    const res = await fetch(`${API}/api/analytics/context`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch {
    return null;
  }
}

export default async function ContextPage() {
  const data = await getData();

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1
            className="font-display"
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Decision Context
          </h1>
          <span
            style={{
              padding: '3px 12px',
              borderRadius: 20,
              fontSize: 10,
              fontFamily: 'DM Mono',
              letterSpacing: '0.1em',
              background: 'rgba(245,158,11,0.12)',
              color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            CONTEXTUAL RECONSTRUCTION
          </span>
        </div>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 13,
            maxWidth: 720,
            lineHeight: 1.7,
          }}
        >
          Standard analytics tells you <em>what</em> users did. This tells you <em>why</em> —
          by reconstructing the full situational context at the moment every decision was made.
          A product viewed after 5 cheaper alternatives is a fundamentally different decision
          than the same product viewed first. These conditional rates surface that difference.
        </p>
      </div>

      {data ? (
        <ContextClient data={data} />
      ) : (
        <div
          style={{
            padding: '64px 32px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 16,
            fontFamily: 'DM Mono',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 16 }}>∅</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            No context data yet.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Either run the seed SQL or browse the storefront to generate real events.
          </div>
          <code
            style={{
              display: 'block',
              padding: '10px 20px',
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              fontSize: 12,
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            python processors/pipeline.py --mode=full
          </code>
        </div>
      )}
    </div>
  );
}
