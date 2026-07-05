import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { config, env } from "./config";

// Auth.js (NextAuth v5). Providers are added only when configured, so the app runs with
// no auth at all, with just the dev email provider, or with real OAuth — all via env.

const providers: NextAuthConfig["providers"] = [];

if (config.googleAuth) {
  providers.push(
    Google({ clientId: env.AUTH_GOOGLE_ID!, clientSecret: env.AUTH_GOOGLE_SECRET! }),
  );
}
if (config.githubAuth) {
  providers.push(
    GitHub({ clientId: env.AUTH_GITHUB_ID!, clientSecret: env.AUTH_GITHUB_SECRET! }),
  );
}
if (config.devLogin) {
  // Dev-only: sign in with just an email (no password). Lets you test multi-user flows
  // without setting up an OAuth app. Do NOT enable in production (AUTH_DEV_LOGIN=false).
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev sign-in",
      credentials: { email: { label: "Email", type: "email" } },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) return null;
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions are required for the Credentials provider and work fine for OAuth too.
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET ?? "insecure-dev-secret-change-in-production",
  trustHost: true,
  providers,
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
