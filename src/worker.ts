import { Worker } from "bullmq";
import { config, env } from "./lib/config";
import { processJob } from "./lib/processor";
import { QUEUE_NAME, redisConnection } from "./lib/queue/bull";

// Standalone transcription worker for production. Run alongside the web app:
//   QUEUE_DRIVER=bullmq REDIS_URL=... npm run worker
// (In Docker this is a second service — see docker-compose.yml.)

if (!config.usesBull || !env.REDIS_URL) {
  console.error("Worker requires QUEUE_DRIVER=bullmq and REDIS_URL to be set.");
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

worker.on("completed", (job) => console.log(`[worker] completed job ${job.id}`));
worker.on("failed", (job, err) =>
  console.error(`[worker] failed job ${job?.id}:`, err?.message),
);

console.log(`[worker] listening on "${QUEUE_NAME}" (concurrency ${concurrency})`);
