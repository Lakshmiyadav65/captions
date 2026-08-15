import { config } from "./config";
import { prisma } from "./db";
import { isPlanId, PLANS, type PlanId } from "./plans";
import { log } from "./log";
import { getAvailableMinutes } from "./credits";

// Per-user guardrails for a hosted, multi-tenant deployment: cap concurrent jobs and
// monthly transcription minutes. Paid Razorpay plans will raise limits via User.plan.

export interface QuotaResult {
  ok: boolean;
  reason?: string;
  code?: "quota_active_jobs" | "quota_minutes" | "quota_analyses" | "quota_generations";
  buyHref?: string;
}

/** Vercel Hobby caps inline ASR at ~300s — anything still "active" past this is stuck. */
const STALE_ACTIVE_JOB_MS = 6 * 60 * 1000;

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Mark zombie queued/extracting/transcribing jobs as failed so they stop blocking uploads. */
export async function failStaleActiveJobs(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_ACTIVE_JOB_MS);
  const result = await prisma.job.updateMany({
    where: {
      userId,
      status: { in: ["queued", "extracting", "transcribing"] },
      updatedAt: { lt: cutoff },
    },
    data: {
      status: "failed",
      error:
        "Processing timed out on the free demo host. Try a shorter clip (under ~5 min), or retry.",
    },
  });
  if (result.count > 0) {
    log.warn("quota.stale_jobs_failed", { userId, count: result.count });
  }
  return result.count;
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

  await failStaleActiveJobs(userId);

  const active = await prisma.job.count({
    where: { userId, status: { in: ["queued", "extracting", "transcribing"] } },
  });
  if (active >= limits.maxActiveJobs) {
    return {
      ok: false,
      code: "quota_active_jobs",
      reason: `You already have ${active} video(s) processing. Wait for one to finish (or retry a stuck job), then try again.`,
    };
  }

  const agg = await prisma.job.aggregate({
    _sum: { durationSec: true },
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
  const usedMinutes = (agg._sum.durationSec ?? 0) / 60;
  const prepaid = await getAvailableMinutes(userId);
  if (usedMinutes >= limits.monthlyMinutes && prepaid <= 0) {
    return {
      ok: false,
      code: "quota_minutes",
      buyHref: "/billing#prepaid",
      reason:
        "You don't have enough caption minutes for this video. Buy more minutes to continue.",
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
  const prepaidMinutes = await getAvailableMinutes(userId);
  return {
    plan: limits.planId,
    planLabel: limits.label,
    usedMinutes: Math.round(((agg._sum.durationSec ?? 0) / 60) * 10) / 10,
    monthlyMinutes: limits.monthlyMinutes,
    prepaidMinutes,
    maxActiveJobs: limits.maxActiveJobs,
    stripeEnabled: config.stripeEnabled,
    prepaidEnabled: Boolean(
      config.stripeEnabled &&
        (config.stripe.priceMinutes5 || config.stripe.priceMinutes10),
    ),
  };
}

/** Monthly minutes already recorded, optionally excluding the job currently being processed. */
export async function monthlyUsedMinutes(userId: string, excludeJobId?: string): Promise<number> {
  const agg = await prisma.job.aggregate({
    _sum: { durationSec: true },
    where: {
      userId,
      createdAt: { gte: startOfMonth() },
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
    },
  });
  return (agg._sum.durationSec ?? 0) / 60;
}
