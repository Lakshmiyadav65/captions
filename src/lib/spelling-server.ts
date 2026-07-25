import { prisma } from "./db";
import type { SpellRule } from "./spelling";

// Server-only loader for a user's saved spelling rules (kept apart from the pure
// ./spelling module so that browser code importing applySpelling never pulls in Prisma).

export async function getUserSpellingRules(
  userId: string | null,
): Promise<SpellRule[]> {
  if (!userId) return [];
  const rows = await prisma.spellingRule.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { from: true, to: true },
  });
  return rows;
}
