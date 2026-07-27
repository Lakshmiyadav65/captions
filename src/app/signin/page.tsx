import Link from "next/link";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { signIn } from "@/lib/auth";
import { currentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/?start=1";
  return v;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  // Auth off → local demo user; send them straight into create.
  if (!config.authEnabled) redirect(next.includes("start=") ? next : "/?start=1");

  const user = await currentUser();
  if (user) redirect(next);

  const hasOAuth = config.googleAuth || config.githubAuth;
  const hasAnyProvider = hasOAuth || config.devLogin;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfcfd] px-4 py-16 text-neutral-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 15% 10%, rgba(255,186,140,0.28), transparent 42%), radial-gradient(ellipse at 85% 0%, rgba(125,211,252,0.28), transparent 40%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center">
            <img src="/logo.png" alt="Caplio" className="h-9 w-auto" />
          </Link>
        </div>

        <div className="rounded-3xl border border-black/8 bg-white/90 p-8 shadow-[0_24px_60px_rgba(17,24,39,0.08)] backdrop-blur-sm">
          <h1 className="text-3xl font-normal tracking-tight text-neutral-900 [font-family:Georgia,'Instrument_Serif',serif]">
            Start free
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
            Sign in to upload Telugu videos, style captions live, and export a burned MP4.
          </p>

          {!hasAnyProvider ? (
            <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Sign-in is almost ready. Add Google OAuth credentials in the host
              environment (<code className="text-xs">AUTH_GOOGLE_ID</code> /{" "}
              <code className="text-xs">AUTH_GOOGLE_SECRET</code>), then redeploy.
            </p>
          ) : (
            <div className="mt-7 space-y-3">
              {config.googleAuth && (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: next });
                  }}
                >
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </form>
              )}

              {config.githubAuth && (
                <form
                  action={async () => {
                    "use server";
                    await signIn("github", { redirectTo: next });
                  }}
                >
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-3 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
                  >
                    <GitHubIcon />
                    Continue with GitHub
                  </button>
                </form>
              )}

              {config.devLogin && (
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await signIn("dev", {
                      email: String(fd.get("email") ?? ""),
                      redirectTo: next,
                    });
                  }}
                  className="space-y-3 border-t border-black/8 pt-5"
                >
                  <label className="block text-xs font-medium text-neutral-500">
                    Dev only — email sign-in
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-neutral-900 outline-none ring-sky-400/40 placeholder:text-neutral-400 focus:ring-2"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                  >
                    Continue
                  </button>
                </form>
              )}
            </div>
          )}

          {hasOAuth && (
            <p className="mt-6 text-center text-xs leading-relaxed text-neutral-400">
              By continuing you agree to use Caplio for your own videos. We never use
              your footage to train public models.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/" className="font-medium text-neutral-700 underline-offset-2 hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.8 2.2 2.5 6.5 2.5 11.8S6.8 21.4 12 21.4c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.46-1.2-1.12-1.52-1.12-1.52-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.8c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .26.18.59.69.48A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}
