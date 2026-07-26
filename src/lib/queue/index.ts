import { after } from "next/server";
import { config } from "../config";
import { processJob } from "../processor";

// Enqueue abstraction. inline = run in-process after the HTTP response (via Next `after()`
// so Vercel keeps the isolate alive). bullmq = push to Redis; a separate worker consumes.

const running = new Set<string>();

export async function enqueueJob(jobId: string): Promise<void> {
  if (config.usesBull) {
    const { addBullJob } = await import("./bull");
    await addBullJob(jobId);
    return;
  }
  if (running.has(jobId)) return;
  running.add(jobId);
  const run = () => processJob(jobId).finally(() => running.delete(jobId));
  // `after()` extends the serverless invocation until processJob finishes (subject to
  // maxDuration). Plain void would freeze mid-job on Vercel after the upload response.
  try {
    after(run);
  } catch {
    void run();
  }
}
