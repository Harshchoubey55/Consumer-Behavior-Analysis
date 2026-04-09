// app/api/analytics/churn/route.ts
// Predictive analytics: churn risk model outputs and engagement scoring

import { NextResponse } from 'next/server';
import { prisma } from 'lib/db';

export async function GET() {
  // Churn risk distribution
  const users = await prisma.userProfile.findMany({
    select: { id: true, churnRisk: true, engagementScore: true, segment: true,
      totalSessions: true, totalPurchases: true, lastSeen: true, totalRevenue: true },
  });

  // Risk buckets
  const riskBuckets = {
    low: users.filter((u) => u.churnRisk < 0.3).length,
    medium: users.filter((u) => u.churnRisk >= 0.3 && u.churnRisk < 0.6).length,
    high: users.filter((u) => u.churnRisk >= 0.6 && u.churnRisk < 0.8).length,
    critical: users.filter((u) => u.churnRisk >= 0.8).length,
  };

  // Engagement score distribution
  const engagementBuckets = {
    disengaged: users.filter((u) => u.engagementScore < 20).length,
    low: users.filter((u) => u.engagementScore >= 20 && u.engagementScore < 40).length,
    medium: users.filter((u) => u.engagementScore >= 40 && u.engagementScore < 70).length,
    high: users.filter((u) => u.engagementScore >= 70).length,
  };

  // Scatter data: churn risk vs engagement score
  const scatterData = users.map((u) => ({
    userId: u.id.slice(0, 8),
    churnRisk: parseFloat((u.churnRisk * 100).toFixed(1)),
    engagementScore: parseFloat(u.engagementScore.toFixed(1)),
    segment: u.segment,
    revenue: u.totalRevenue,
  }));

  // High-risk, high-value users (most important to retain)
  const atRisk = users
    .filter((u) => u.churnRisk >= 0.6 && u.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 20)
    .map((u) => ({
      ...u,
      daysSinceLastSeen: u.lastSeen
        ? Math.floor((Date.now() - new Date(u.lastSeen).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

  // Model feature importance (descriptive - reflects the heuristic model weights)
  const featureImportance = [
    { feature: 'Days since last visit', importance: 0.38 },
    { feature: 'Purchase history', importance: 0.24 },
    { feature: 'Session frequency', importance: 0.18 },
    { feature: 'Cart interactions', importance: 0.12 },
    { feature: 'Product view depth', importance: 0.08 },
  ];

  // Predicted cohort outcomes (7-day forecast based on current risk)
  const willChurn7d = users.filter((u) => u.churnRisk > 0.75).length;
  const willEngage7d = users.filter((u) => u.engagementScore > 60 && u.churnRisk < 0.3).length;

  return NextResponse.json({
    summary: {
      totalUsers: users.length,
      avgChurnRisk: parseFloat((users.reduce((s, u) => s + u.churnRisk, 0) / users.length * 100).toFixed(1)),
      avgEngagementScore: parseFloat((users.reduce((s, u) => s + u.engagementScore, 0) / users.length).toFixed(1)),
      willChurn7d,
      willEngage7d,
    },
    riskBuckets: [
      { name: 'Low Risk', value: riskBuckets.low, color: '#22c55e' },
      { name: 'Medium Risk', value: riskBuckets.medium, color: '#f59e0b' },
      { name: 'High Risk', value: riskBuckets.high, color: '#f97316' },
      { name: 'Critical', value: riskBuckets.critical, color: '#ef4444' },
    ],
    engagementBuckets: [
      { name: 'Disengaged', value: engagementBuckets.disengaged },
      { name: 'Low', value: engagementBuckets.low },
      { name: 'Medium', value: engagementBuckets.medium },
      { name: 'High', value: engagementBuckets.high },
    ],
    scatterData,
    atRisk,
    featureImportance,
  });
}
