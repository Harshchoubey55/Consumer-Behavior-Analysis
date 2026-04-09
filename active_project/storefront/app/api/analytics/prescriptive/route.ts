// app/api/analytics/prescriptive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { runFullPipeline } from 'lib/analytics/processor';

export async function GET() {
  const insights = await prisma.insight.findMany({
    where: { dismissed: false },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  });

  // Sort: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) =>
    (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) -
    (severityOrder[b.severity as keyof typeof severityOrder] ?? 3)
  );

  return NextResponse.json({ insights });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json();

  if (action === 'reprocess') {
    const result = await runFullPipeline();
    return NextResponse.json(result);
  }

  if (action === 'dismiss') {
    const { id } = await req.json();
    await prisma.insight.update({ where: { id }, data: { dismissed: true } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
