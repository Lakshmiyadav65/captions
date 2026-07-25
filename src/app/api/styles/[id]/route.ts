import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/styles/[id] — remove a saved style (and its screenshot) the user owns.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to delete a style." }, { status: 401 });
  }

  const { id } = await params;
  const style = await prisma.savedStyle.findUnique({ where: { id } });
  // 404 (not 403) so we don't leak whether another user's style exists.
  if (!style || style.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (style.sourceImageKey) {
    await getStorage().delete(style.sourceImageKey).catch(() => {});
  }
  await prisma.savedStyle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
