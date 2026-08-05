import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser, requireUserId } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { AppShell } from "@/components/console/AppShell";
import { MyStylesGallery } from "@/components/style-analyzer/MyStylesGallery";
import type { SavedStyleDTO, StyleProfile } from "@/lib/vision/types";
import type { SubtitleStyle } from "@/lib/subtitles/style";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Styles — Telugu Captions",
};

export default async function StylesPage() {
  const userId = await requireUserId();
  if (userId === null) redirect("/signin");

  const storage = getStorage();
  const user = await currentUser();
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
    <AppShell
      section="styles"
      user={user}
      title="Caption styles"
      titleExtra={<span className="count">{styles.length} saved</span>}
      headActions={
        <Link href="/style-analyzer" className="tc-btn tc-btn--sm">
          Analyze a style
        </Link>
      }
    >
      <div className="tc-pane-scroll" style={{ padding: "20px 24px" }}>
        <MyStylesGallery initial={styles} />
      </div>
    </AppShell>
  );
}
