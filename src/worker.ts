import { Worker } from "bullmq";
import { config, env } from "./lib/config";
import { processJob } from "./lib/processor";
import { QUEUE_NAME, redisConnection } from "./lib/queue/bull";
import { log } from "./lib/log";
import { reportError } from "./lib/sentry";

// Standalone transcription worker for production. Run alongside the web app:
//   QUEUE_DRIVER=bullmq REDIS_URL=... npm run worker
// (In Docker this is a second service — see docker-compose.yml.)

if (!config.usesBull || !env.REDIS_URL) {
  log.error("worker.misconfigured", {
    usesBull: config.usesBull,
    hasRedis: Boolean(env.REDIS_URL),
  });
  process.exit(1);
}

const concurrency = Number(process.env.WORKER_CONCURRENCY || 2);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processJob(job.data.jobId as string);
  },
  { connection: redisConnection(), concurrency },
);

worker.on("completed", (job) =>
  log.info("worker.completed", { queueJobId: job.id, jobId: job.data.jobId }),
);
worker.on("failed", (job, err) => {
  void reportError("worker.failed", err, {
    queueJobId: job?.id,
    jobId: job?.data?.jobId,
  });
});

log.info("worker.listening", { queue: QUEUE_NAME, concurrency });
