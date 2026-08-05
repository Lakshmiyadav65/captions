import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { currentUser, requireUserId } from "@/lib/auth-helpers";
import { resolveVideoUrl } from "@/lib/storage/resolve";
import { Editor } from "@/components/Editor";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || !job.videoKey) notFound();

  // When auth is on, don't reveal someone else's job.
  if (config.authEnabled) {
    const userId = await requireUserId();
    if (job.userId && job.userId !== userId) notFound();
  }

  const videoUrl = await resolveVideoUrl(job.videoKey);
  const user = await currentUser();

  return (
    <Editor
      jobId={job.id}
      videoUrl={videoUrl}
      originalName={job.originalName}
      initialStatus={job.status}
      initialProgress={job.progress}
      initialProvider={job.provider}
      initialLanguage={job.language}
      initialError={job.error}
      width={job.width}
      height={job.height}
      user={user}
    />
  );
}
