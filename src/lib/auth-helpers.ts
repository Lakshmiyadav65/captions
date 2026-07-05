import { config } from "./config";
import { prisma } from "./db";

// Resolves the acting user. When AUTH_ENABLED=false the whole app runs as a single
// auto-created "local dev" user, so jobs still have an owner and quotas still apply —
// without forcing sign-in during local development.

const DEV_EMAIL = "local@dev";
let devUserIdCache: string | null = null;

async function devUserId(): Promise<string> {
  if (devUserIdCache) return devUserIdCache;
  const user = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: {},
    create: { email: DEV_EMAIL, name: "Local dev" },
  });
  devUserIdCache = user.id;
  return user.id;
}

/** User id for the current request, or null if auth is on and nobody is signed in. */
export async function requireUserId(): Promise<string | null> {
  if (!config.authEnabled) return devUserId();
  const { auth } = await import("./auth");
  const session = await auth();
  return session?.user?.id ?? null;
}

export interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function currentUser(): Promise<CurrentUser | null> {
  if (!config.authEnabled) {
    return { id: await devUserId(), email: DEV_EMAIL, name: "Local dev" };
  }
  const { auth } = await import("./auth");
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}
