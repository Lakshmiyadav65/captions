import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { UserMenu } from "@/components/UserMenu";
import { MyStylesGallery } from "@/components/style-analyzer/MyStylesGallery";
import type { SavedStyleDTO, StyleProfile } from "@/lib/vision/types";
import type { SubtitleStyle } from "@/lib/subtitles/style";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Styles — Telugu Captions",
};

export default async function StylesPage() {
  const userId = await requireUserId();
  if (userId === null) redirect("/signin");

  const storage = getStorage();
  const rows = await prisma.savedStyle.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const styles: SavedStyleDTO[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      confidence: r.confidence,
      createdAt: r.createdAt.toISOString(),
      profile: JSON.parse(r.profile) as StyleProfile,
      subtitleStyle: JSON.parse(r.subtitleStyle) as SubtitleStyle,
      imageUrl: r.sourceImageKey ? await storage.getUrl(r.sourceImageKey) : null,
    })),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-4 text-sm">
          <a href="/create" className="text-sky-400 hover:text-sky-300">
            ← Create
          </a>
          <a href="/style-analyzer" className="text-neutral-400 hover:text-neutral-200">
            Analyze a style
          </a>
        </nav>
        <UserMenu />
      </header>

      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">My Styles</h1>
      <MyStylesGallery initial={styles} />
    </main>
  );
}
