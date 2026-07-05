import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "../config";

// BullMQ queue (production). The web app only ADDS jobs; the standalone worker
// (src/worker.ts) consumes them. We pass connection *options* (not an ioredis instance)
// so BullMQ uses its own bundled ioredis and there's no dual-package type clash.

export const QUEUE_NAME = "transcription";

const globalForQueue = globalThis as unknown as { asrQueue?: Queue };

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

export async function addBullJob(jobId: string): Promise<void> {
  await getQueue().add(
    "transcribe",
    { jobId },
    {
      jobId, // dedupe: one queue entry per job
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
    },
  );
}
