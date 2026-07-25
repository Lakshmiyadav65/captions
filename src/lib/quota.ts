import { config } from "./config";
import { prisma } from "./db";
import { isPlanId, PLANS, type PlanId } from "./plans";

// Per-user guardrails for a hosted, multi-tenant deployment: cap concurrent jobs and
// monthly transcription minutes. Paid Stripe plans raise limits via User.plan.

export interface QuotaResult {
  ok: boolean;
  reason?: string;
  code?: "quota_active_jobs" | "quota_minutes" | "quota_analyses" | "quota_generations";
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getUserPlanId(userId: string): Promise<PlanId> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return isPlanId(user?.plan) ? user.plan : "free";
}

export async function getUserLimits(userId: string) {
  const planId = await getUserPlanId(userId);
  if (planId === "free") {
    return {
      planId,
      label: PLANS.free.label,
      monthlyMinutes: config.limits.monthlyMinutes,
      maxActiveJobs: config.limits.maxActiveJobs,
    };
  }
  const p = PLANS[planId];
  return {
    planId,
    label: p.label,
    monthlyMinutes: p.monthlyMinutes,
    maxActiveJobs: p.maxActiveJobs,
  };
}

export async function assertWithinQuota(userId: string): Promise<QuotaResult> {
  const limits = await getUserLimits(userId);

  const active = await prisma.job.count({
    where: { userId, status: { in: ["queued", "extracting", "transcribing"] } },
  });
  if (active >= limits.maxActiveJobs) {
    return {
      ok: false,
      code: "quota_active_jobs",
      reason: `You already have ${active} video(s) processing. Wait for one to finish, then try again.`,
    };
  }

  const agg = await prisma.job.aggregate({
    _sum: { durationSec: true },
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
  const usedMinutes = (agg._sum.durationSec ?? 0) / 60;
  if (usedMinutes >= limits.monthlyMinutes) {
    return {
      ok: false,
      code: "quota_minutes",
      reason: `You've used your monthly ${limits.monthlyMinutes} minutes on the ${limits.label} plan. Upgrade or wait until next month.`,
    };
  }

  return { ok: true };
}

export async function assertWithinAnalysisQuota(userId: string): Promise<QuotaResult> {
  const used = await prisma.styleAnalysis.count({
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
  if (used >= config.limits.monthlyAnalyses) {
    return {
      ok: false,
      code: "quota_analyses",
      reason: `You've reached this month's limit of ${config.limits.monthlyAnalyses} style analyses. Try again next month.`,
    };
  }
  return { ok: true };
}

export async function assertWithinGenerationQuota(userId: string): Promise<QuotaResult> {
  const used = await prisma.generationLog.count({
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
  if (used >= config.limits.monthlyGenerations) {
    return {
      ok: false,
      code: "quota_generations",
      reason: `You've reached this month's limit of ${config.limits.monthlyGenerations} AI caption generations.`,
    };
  }
  return { ok: true };
}

export async function usageSummary(userId: string) {
  const limits = await getUserLimits(userId);
  const agg = await prisma.job.aggregate({
    _sum: { durationSec: true },
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
  return {
    plan: limits.planId,
    planLabel: limits.label,
    usedMinutes: Math.round(((agg._sum.durationSec ?? 0) / 60) * 10) / 10,
    monthlyMinutes: limits.monthlyMinutes,
    maxActiveJobs: limits.maxActiveJobs,
    stripeEnabled: config.stripeEnabled,
  };
}
