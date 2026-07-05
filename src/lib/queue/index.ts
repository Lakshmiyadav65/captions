import { config } from "../config";
import { processJob } from "../processor";

// Enqueue abstraction. inline = fire-and-forget in-process (dev / single server).
// bullmq = push to Redis; a separate worker process runs the job (prod / scale).

const running = new Set<string>();

export async function enqueueJob(jobId: string): Promise<void> {
  if (config.usesBull) {
    const { addBullJob } = await import("./bull");
    await addBullJob(jobId);
    return;
  }
  if (running.has(jobId)) return;
  running.add(jobId);
  void processJob(jobId).finally(() => running.delete(jobId));
}
