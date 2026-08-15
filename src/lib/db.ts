import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads in Next.js. After `prisma generate`,
// a cached client can be missing new models (e.g. creditBalance) and then crash with
// "Cannot read properties of undefined (reading 'findUnique')".
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function hasRequiredModels(client: PrismaClient): boolean {
  return (
    typeof client.user?.findUnique === "function" &&
    typeof client.job?.findUnique === "function" &&
    typeof client.creditBalance?.findUnique === "function"
  );
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && hasRequiredModels(existing)) return existing;
  const client = createPrisma();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function friendlyDbError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (
    lower.includes("findunique") ||
    lower.includes("findmany") ||
    lower.includes("cannot read properties of undefined") ||
    lower.includes("cannot read property")
  ) {
    return "Database client is out of date. Restart the Next.js server and try the upload again.";
  }
  if (
    lower.includes("database") ||
    lower.includes("prisma") ||
    lower.includes("sqlite") ||
    lower.includes("postgres") ||
    lower.includes("p1001") ||
    lower.includes("p1003") ||
    lower.includes("p1010") ||
    lower.includes("does not exist") ||
    lower.includes("can't reach") ||
    lower.includes("econnrefused")
  ) {
    return (
      "Database is not configured for this deploy. On Vercel set DATABASE_URL to a " +
      "Postgres URL (Neon / Vercel Postgres), enable it for Production and Build, " +
      "then run: npx prisma db push"
    );
  }
  return null;
}
