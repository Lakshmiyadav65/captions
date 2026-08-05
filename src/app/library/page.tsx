import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser, requireUserId } from "@/lib/auth-helpers";
import { config } from "@/lib/config";
import {
  LibraryClient,
  type LibraryJob,
} from "@/components/console/LibraryClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Library — Telugu Captions",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const userId = await requireUserId();
  if (config.authEnabled && userId === null) {
    redirect(`/signin?next=${encodeURIComponent("/library")}`);
  }

  const { filter } = await searchParams;
  const user = await currentUser();

  const rows = userId
    ? await prisma.job.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          progress: true,
          originalName: true,
          durationSec: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];

  const jobs: LibraryJob[] = rows.map((j) => ({
    id: j.id,
    status: j.status,
    progress: j.progress,
    originalName: j.originalName ?? "Untitled video",
    durationSec: j.durationSec,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  }));

  const initialFilter =
    filter === "draft" || filter === "done" || filter === "work" ? filter : "all";

  return (
    <Suspense
      fallback={
        <div className="console">
          <div style={{ padding: 24 }}>Loading library…</div>
        </div>
      }
    >
      <LibraryClient jobs={jobs} user={user} initialFilter={initialFilter} />
    </Suspense>
  );
}
