import { prisma } from "./db";
import {
  InsufficientCreditsError,
  getAvailableMinutes,
  minutesFromDurationSec,
  useMinutes,
} from "./credits";

export async function handleGetBalance(userId: string | null) {
  if (!userId) {
    return {
      status: 401 as const,
      body: { error: "Sign in required." },
    };
  }
  const available_minutes = await getAvailableMinutes(userId);
  return {
    status: 200 as const,
    body: {
      available_minutes,
      availableMinutes: available_minutes,
    },
  };
}

export type UseMinutesBody = {
  video_id?: unknown;
  videoId?: unknown;
  minutes?: unknown;
  available_minutes?: unknown;
  user_id?: unknown;
  userId?: unknown;
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * Deduct caption minutes for the authenticated user.
 * Client-supplied user_id, available_minutes, and minutes are not trusted.
 * Usage is computed from the stored video duration when video_id is present.
 */
export async function handleUseMinutes(userId: string | null, body: UseMinutesBody) {
  if (!userId) {
    return {
      status: 401 as const,
      body: { error: "Sign in required." },
    };
  }

  const requested = Number(body.minutes);
  if (body.minutes !== undefined && (!Number.isFinite(requested) || requested <= 0)) {
    return {
      status: 400 as const,
      body: { error: "minutes must be greater than 0" },
    };
  }

  const videoId = asString(body.video_id) ?? asString(body.videoId);
  if (!videoId) {
    return {
      status: 400 as const,
      body: { error: "video_id is required" },
    };
  }

  const job = await prisma.job.findUnique({
    where: { id: videoId },
    select: { userId: true, durationSec: true, creditReservedMin: true },
  });
  if (!job || job.userId !== userId) {
    return {
      status: 404 as const,
      body: { error: "Video not found" },
    };
  }
  if (job.creditReservedMin > 0) {
    const available_minutes = await getAvailableMinutes(userId);
    return {
      status: 200 as const,
      body: { available_minutes, availableMinutes: available_minutes },
    };
  }
  if (job.durationSec == null || job.durationSec <= 0) {
    return {
      status: 400 as const,
      body: { error: "Video duration is not available yet." },
    };
  }

  const minutes = minutesFromDurationSec(job.durationSec);
  if (!(minutes > 0)) {
    return {
      status: 400 as const,
      body: { error: "minutes must be greater than 0" },
    };
  }

  try {
    const result = await useMinutes({
      userId,
      minutes,
      videoId,
    });
    return {
      status: 200 as const,
      body: {
        available_minutes: result.availableMinutes,
        availableMinutes: result.availableMinutes,
      },
    };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return {
        status: 402 as const,
        body: { error: err.message, code: err.code },
      };
    }
    const message = err instanceof Error ? err.message : "Could not use minutes";
    return { status: 500 as const, body: { error: message } };
  }
}
