import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events stream of a job's progress. The client subscribes with EventSource
// and closes once status is done/failed. (Phase 1 polls the DB; Phase 2 pushes from the queue.)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // Cap the loop so a stuck job can't hold the connection forever (~5 min).
        for (let i = 0; i < 375; i++) {
          const job = await prisma.job.findUnique({ where: { id } });
          if (!job) {
            send({ status: "failed", error: "Job not found" });
            break;
          }
          send({
            status: job.status,
            progress: job.progress,
            provider: job.provider,
            language: job.language,
            error: job.error,
          });
          if (job.status === "done" || job.status === "failed") break;
          await new Promise((r) => setTimeout(r, 800));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
