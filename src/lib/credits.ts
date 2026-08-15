import { Prisma } from "@prisma/client";
import { config } from "./config";
import {
  CREDIT_PACKS,
  InsufficientCreditsError,
  isCreditPackId,
  minutesFromDurationSec,
  prepaidMinutesNeeded,
  round1,
  type CreditPackId,
} from "./credits-catalog";
import { prisma } from "./db";

export {
  CREDIT_PACKS,
  InsufficientCreditsError,
  isCreditPackId,
  minutesFromDurationSec,
  prepaidMinutesNeeded,
};
export type { CreditPackId, CreditTxnType } from "./credits-catalog";

export function stripePriceIdForPack(packId: CreditPackId): string {
  return packId === "minutes_10"
    ? config.stripe.priceMinutes10
    : config.stripe.priceMinutes5;
}

export async function getAvailableMinutes(userId: string): Promise<number> {
  return grantFreeMinutesOnce(userId);
}

/**
 * Give the configured free caption minutes exactly once per user.
 * Concurrent callers cannot double-grant: CreditBalance.userId is the primary key.
 */
export async function grantFreeMinutesOnce(userId: string): Promise<number> {
  const amount = round1(Math.max(0, config.limits.freeCaptionMinutes));
  const existing = await prisma.creditBalance.findUnique({
    where: { userId },
    select: { availableMinutes: true },
  });

  if (existing) {
    const current = round1(Math.max(0, existing.availableMinutes));
    if (current > 0) return current;
    const ledgerCount = await prisma.creditTransaction.count({ where: { userId } });
    if (ledgerCount > 0) return current;

    const claimed = await prisma.$transaction(async (tx) => {
      const stillEmpty = await tx.creditTransaction.count({ where: { userId } });
      if (stillEmpty > 0) return 0;
      const updated = await tx.creditBalance.updateMany({
        where: { userId, availableMinutes: 0 },
        data: { availableMinutes: amount },
      });
      if (updated.count !== 1) return 0;
      await tx.creditTransaction.create({
        data: {
          userId,
          type: "GRANT",
          minutes: amount,
          balanceBefore: 0,
          balanceAfter: amount,
          description: "Free caption minutes",
          status: "COMPLETED",
        },
      });
      return amount;
    });
    if (claimed > 0) return claimed;
    const row = await prisma.creditBalance.findUnique({
      where: { userId },
      select: { availableMinutes: true },
    });
    return round1(Math.max(0, row?.availableMinutes ?? 0));
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.creditBalance.create({
        data: { userId, availableMinutes: amount },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          type: "GRANT",
          minutes: amount,
          balanceBefore: 0,
          balanceAfter: amount,
          description: "Free caption minutes",
          status: "COMPLETED",
        },
      });
    });
    return amount;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await prisma.creditBalance.findUnique({
        where: { userId },
        select: { availableMinutes: true },
      });
      return round1(Math.max(0, row?.availableMinutes ?? 0));
    }
    throw err;
  }
}

async function ensureBalance(userId: string) {
  return prisma.creditBalance.upsert({
    where: { userId },
    create: { userId, availableMinutes: 0 },
    update: {},
  });
}

/**
 * Credit a paid purchase. Idempotent: a second call with the same purchase/payment
 * does not add minutes twice.
 */
export async function applyPaidPurchase(opts: {
  purchaseId: string;
  paymentId?: string | null;
}): Promise<{ credited: boolean; availableMinutes: number }> {
  const { purchaseId, paymentId } = opts;

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.creditPurchase.updateMany({
      where: { id: purchaseId, status: "PENDING" },
      data: {
        status: "PAID",
        paymentId: paymentId || undefined,
      },
    });

    const purchase = await tx.creditPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new Error("Purchase not found");
    }

    if (claimed.count === 0) {
      const bal = await tx.creditBalance.findUnique({
        where: { userId: purchase.userId },
      });
      return {
        credited: false,
        availableMinutes: round1(bal?.availableMinutes ?? 0),
      };
    }

    const beforeRow = await tx.creditBalance.findUnique({
      where: { userId: purchase.userId },
    });
    const before = round1(beforeRow?.availableMinutes ?? 0);

    await tx.creditBalance.upsert({
      where: { userId: purchase.userId },
      create: { userId: purchase.userId, availableMinutes: purchase.minutes },
      update: { availableMinutes: { increment: purchase.minutes } },
    });

    const after = round1(before + purchase.minutes);
    await tx.creditTransaction.create({
      data: {
        userId: purchase.userId,
        type: "PURCHASE",
        minutes: purchase.minutes,
        balanceBefore: before,
        balanceAfter: after,
        paymentId: paymentId ?? purchase.paymentId,
        orderId: purchase.orderId,
        description: `${purchase.packId} pack`,
        status: "COMPLETED",
      },
    });

    return { credited: true, availableMinutes: after };
  });
}

export async function markPurchaseFailed(purchaseId: string): Promise<void> {
  await prisma.creditPurchase.updateMany({
    where: { id: purchaseId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}

/** Reverse a previously PAID purchase. Idempotent via REFUNDED status. */
export async function refundPurchase(purchaseId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.creditPurchase.updateMany({
      where: { id: purchaseId, status: "PAID" },
      data: { status: "REFUNDED" },
    });
    if (claimed.count === 0) return false;

    const purchase = await tx.creditPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) return false;

    const beforeRow = await tx.creditBalance.findUnique({
      where: { userId: purchase.userId },
    });
    const before = round1(beforeRow?.availableMinutes ?? 0);
    const after = round1(Math.max(0, before - purchase.minutes));

    await tx.creditBalance.upsert({
      where: { userId: purchase.userId },
      create: { userId: purchase.userId, availableMinutes: after },
      update: { availableMinutes: after },
    });

    await tx.creditTransaction.create({
      data: {
        userId: purchase.userId,
        type: "REFUND",
        minutes: -Math.min(before, purchase.minutes),
        balanceBefore: before,
        balanceAfter: after,
        paymentId: purchase.paymentId,
        orderId: purchase.orderId,
        description: `Refund ${purchase.packId}`,
        status: "COMPLETED",
      },
    });
    return true;
  });
}

/**
 * Atomically deduct prepaid minutes. Never goes negative.
 * Returns the new balance, or throws InsufficientCreditsError.
 */
export async function useMinutes(opts: {
  userId: string;
  minutes: number;
  videoId?: string;
  description?: string;
}): Promise<{ availableMinutes: number }> {
  const minutes = round1(opts.minutes);
  if (!(minutes > 0)) {
    throw new Error("minutes must be greater than 0");
  }

  await grantFreeMinutesOnce(opts.userId);

  const result = await prisma.$transaction(async (tx) => {
    const beforeRow = await tx.creditBalance.findUnique({
      where: { userId: opts.userId },
    });
    const before = round1(beforeRow?.availableMinutes ?? 0);

    const updated = await tx.creditBalance.updateMany({
      where: { userId: opts.userId, availableMinutes: { gte: minutes } },
      data: { availableMinutes: { decrement: minutes } },
    });
    if (updated.count !== 1) {
      return { ok: false as const, availableMinutes: before };
    }

    const after = round1(before - minutes);
    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        type: "USAGE",
        minutes: -minutes,
        balanceBefore: before,
        balanceAfter: after,
        videoId: opts.videoId,
        description: opts.description ?? "Caption processing",
        status: "COMPLETED",
      },
    });
    return { ok: true as const, availableMinutes: after };
  });

  if (!result.ok) {
    throw new InsufficientCreditsError();
  }
  return { availableMinutes: result.availableMinutes };
}

/** Reserve prepaid overflow for a job. No-op if monthly quota covers the duration. */
export async function reserveJobCredits(opts: {
  userId: string;
  jobId: string;
  videoMinutes: number;
  monthlyMinutes: number;
  usedMinutes: number;
}): Promise<{ reserved: number }> {
  const needed = prepaidMinutesNeeded(
    opts.monthlyMinutes,
    opts.usedMinutes,
    opts.videoMinutes,
  );
  if (needed <= 0) {
    return { reserved: 0 };
  }

  await grantFreeMinutesOnce(opts.userId);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.job.updateMany({
      where: { id: opts.jobId, creditReservedMin: 0 },
      data: { creditReservedMin: needed },
    });
    if (claimed.count === 0) {
      const job = await tx.job.findUnique({
        where: { id: opts.jobId },
        select: { creditReservedMin: true },
      });
      return { reserved: job?.creditReservedMin ?? 0 };
    }

    const beforeRow = await tx.creditBalance.findUnique({
      where: { userId: opts.userId },
    });
    const before = round1(beforeRow?.availableMinutes ?? 0);

    const updated = await tx.creditBalance.updateMany({
      where: { userId: opts.userId, availableMinutes: { gte: needed } },
      data: { availableMinutes: { decrement: needed } },
    });
    if (updated.count !== 1) {
      await tx.job.update({
        where: { id: opts.jobId },
        data: { creditReservedMin: 0 },
      });
      return { reserved: -1 };
    }

    const after = round1(before - needed);
    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        type: "USAGE",
        minutes: -needed,
        balanceBefore: before,
        balanceAfter: after,
        videoId: opts.jobId,
        description: `Reserved for job ${opts.jobId}`,
        status: "COMPLETED",
      },
    });
    return { reserved: needed };
  }).then((result) => {
    if (result.reserved < 0) throw new InsufficientCreditsError();
    return result;
  });
}

export async function releaseJobCredits(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { userId: true, creditReservedMin: true },
  });
  if (!job?.userId || !(job.creditReservedMin > 0)) return;

  const minutes = job.creditReservedMin;
  await prisma.$transaction(async (tx) => {
    const beforeRow = await tx.creditBalance.findUnique({
      where: { userId: job.userId! },
    });
    const before = round1(beforeRow?.availableMinutes ?? 0);
    await tx.creditBalance.upsert({
      where: { userId: job.userId! },
      create: { userId: job.userId!, availableMinutes: minutes },
      update: { availableMinutes: { increment: minutes } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: job.userId!,
        type: "REFUND",
        minutes,
        balanceBefore: before,
        balanceAfter: round1(before + minutes),
        videoId: jobId,
        description: `Released unused reservation for job ${jobId}`,
        status: "RELEASED",
      },
    });
    await tx.job.update({
      where: { id: jobId },
      data: { creditReservedMin: 0 },
    });
  });
}

export async function adjustMinutes(opts: {
  userId: string;
  minutes: number;
  description?: string;
}): Promise<{ availableMinutes: number }> {
  const delta = round1(opts.minutes);
  if (delta === 0) {
    return { availableMinutes: await getAvailableMinutes(opts.userId) };
  }

  await ensureBalance(opts.userId);
  return prisma.$transaction(async (tx) => {
    const beforeRow = await tx.creditBalance.findUnique({
      where: { userId: opts.userId },
    });
    const before = round1(beforeRow?.availableMinutes ?? 0);
    const after = round1(Math.max(0, before + delta));
    await tx.creditBalance.update({
      where: { userId: opts.userId },
      data: { availableMinutes: after },
    });
    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        type: "ADJUSTMENT",
        minutes: delta,
        balanceBefore: before,
        balanceAfter: after,
        description: opts.description ?? "Admin adjustment",
        status: "COMPLETED",
      },
    });
    return { availableMinutes: after };
  });
}

export async function listTransactions(userId: string, take = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
