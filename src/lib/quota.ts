import { config } from "./config";
import { prisma } from "./db";

// Per-user guardrails for a hosted, multi-tenant deployment: cap concurrent jobs and
// monthly transcription minutes. (Upload byte-size + max video length are enforced in
// the upload route and processor respectively.)

export interface QuotaResult {
  ok: boolean;
  reason?: string;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function assertWithinQuota(userId: string): Promise<QuotaResult> {
  const active = await prisma.job.count({
    where: { userId, status: { in: ["queued", "extracting", "transcribing"] } },
  });
  if (active >= config.limits.maxActiveJobs) {
    return {
      ok: false,
      reason: `You already have ${active} video(s) processing. Please wait for them to finish.`,
    };
  }

  const agg = await prisma.job.aggregate({
    _sum: { durationSec: true },
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
  const usedMinutes = (agg._sum.durationSec ?? 0) / 60;
  if (usedMinutes >= config.limits.monthlyMinutes) {
    return {
      ok: false,
      reason: `You've reached your monthly limit of ${config.limits.monthlyMinutes} minutes.`,
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
      reason: `You've reached your monthly limit of ${config.limits.monthlyAnalyses} style analyses.`,
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
      reason: `You've reached your monthly limit of ${config.limits.monthlyGenerations} caption generations.`,
    };
  }
  return { ok: true };
}

export async function usageSummary(userId: string) {
  const agg = await prisma.job.aggregate({
    _sum: { durationSec: true },
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
  return {
    usedMinutes: Math.round(((agg._sum.durationSec ?? 0) / 60) * 10) / 10,
    monthlyMinutes: config.limits.monthlyMinutes,
  };
}
