import { Queue, QueueEvents, type ConnectionOptions } from "bullmq";
import { env } from "../config";
import type { ExportBurnInput, ExportBurnResult } from "../export-burn";

// BullMQ queues (production). Web ADDS jobs; standalone worker (src/worker.ts) consumes.
// Pass connection *options* (not an ioredis instance) so BullMQ uses its bundled ioredis.

export const QUEUE_NAME = "transcription";
export const EXPORT_QUEUE_NAME = "export";

const globalForQueue = globalThis as unknown as {
  asrQueue?: Queue;
  exportQueue?: Queue;
  exportEvents?: QueueEvents;
};

export function redisConnection(): ConnectionOptions {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is required when QUEUE_DRIVER=bullmq");
  }
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function getQueue(): Queue {
  if (!globalForQueue.asrQueue) {
    globalForQueue.asrQueue = new Queue(QUEUE_NAME, {
      connection: redisConnection(),
    });
  }
  return globalForQueue.asrQueue;
}

export function getExportQueue(): Queue {
  if (!globalForQueue.exportQueue) {
    globalForQueue.exportQueue = new Queue(EXPORT_QUEUE_NAME, {
      connection: redisConnection(),
    });
  }
  return globalForQueue.exportQueue;
}

function getExportEvents(): QueueEvents {
  if (!globalForQueue.exportEvents) {
    globalForQueue.exportEvents = new QueueEvents(EXPORT_QUEUE_NAME, {
      connection: redisConnection(),
    });
  }
  return globalForQueue.exportEvents;
}

export async function addBullJob(jobId: string): Promise<void> {
  await getQueue().add(
    "transcribe",
    { jobId },
    {
      jobId,
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
    },
  );
}

/** Enqueue an MP4 burn and wait for the worker result (keeps /api/export response shape). */
export async function enqueueExportAndWait(
  input: ExportBurnInput,
  timeoutMs = 14 * 60 * 1000,
): Promise<ExportBurnResult> {
  const queue = getExportQueue();
  const events = getExportEvents();
  await events.waitUntilReady();

  const bullId = `export-${input.jobId}`;
  const existing = await queue.getJob(bullId);
  if (existing) {
    const state = await existing.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      throw new Error("Export already in progress.");
    }
    await existing.remove().catch(() => undefined);
  }

  const bullJob = await queue.add("burn", input, {
    jobId: bullId,
    removeOnComplete: true,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: "exponential", delay: 8000 },
  });

  const result = (await bullJob.waitUntilFinished(
    events,
    timeoutMs,
  )) as ExportBurnResult;
  return result;
}
