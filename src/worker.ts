import { Worker } from "bullmq";
import { config, env } from "./lib/config";
import { processJob } from "./lib/processor";
import { prisma } from "./lib/db";
import { burnCaptionedMp4, type ExportBurnInput, type ExportBurnProgress } from "./lib/export-burn";
import {
  EXPORT_QUEUE_NAME,
  QUEUE_NAME,
  redisConnection,
} from "./lib/queue/bull";
import { log } from "./lib/log";
import { reportError } from "./lib/sentry";

// Standalone worker for production. Run alongside the web app:
//   QUEUE_DRIVER=bullmq REDIS_URL=... npm run worker
// Handles transcription + MP4 export burns (CPU-heavy work stays off the web process).

if (!config.usesBull || !env.REDIS_URL) {
  log.error("worker.misconfigured", {
    usesBull: config.usesBull,
    hasRedis: Boolean(env.REDIS_URL),
  });
  process.exit(1);
}

const concurrency = Number(process.env.WORKER_CONCURRENCY || 2);
const exportConcurrency = Number(process.env.EXPORT_WORKER_CONCURRENCY || 1);
const connection = redisConnection();

const asrWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processJob(job.data.jobId as string);
  },
  { connection, concurrency },
);

const exportWorker = new Worker(
  EXPORT_QUEUE_NAME,
  async (job) => {
    const input = job.data as ExportBurnInput;
    log.info("export.started", { jobId: input.jobId, queueJobId: job.id });
    return burnCaptionedMp4(input, {
      onProgress: async (update: ExportBurnProgress) => {
        await job.updateProgress(update);
        await prisma.job
          .update({
            where: { id: input.jobId },
            data: {
              exportStatus: update.status,
              exportProgress: update.percent,
            },
          })
          .catch(() => undefined);
      },
    });
  },
  { connection, concurrency: exportConcurrency },
);

asrWorker.on("completed", (job) =>
  log.info("worker.completed", { queueJobId: job.id, jobId: job.data.jobId }),
);
asrWorker.on("failed", (job, err) => {
  void reportError("worker.failed", err, {
    queueJobId: job?.id,
    jobId: job?.data?.jobId,
  });
});

exportWorker.on("completed", (job) =>
  log.info("export.completed", {
    queueJobId: job.id,
    jobId: (job.data as ExportBurnInput)?.jobId,
  }),
);
exportWorker.on("failed", (job, err) => {
  const jobId = (job?.data as ExportBurnInput | undefined)?.jobId;
  void reportError("export.failed", err, {
    queueJobId: job?.id,
    jobId,
  });
  if (jobId) {
    void prisma.job
      .update({
        where: { id: jobId },
        data: {
          exportStatus: "failed",
          exportError: err instanceof Error ? err.message.slice(0, 500) : "Export failed",
        },
      })
      .catch(() => undefined);
  }
});

log.info("worker.listening", {
  queues: [QUEUE_NAME, EXPORT_QUEUE_NAME],
  concurrency,
  exportConcurrency,
});
