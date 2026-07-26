import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  // With auth disabled there's nothing to sign into — everything runs as the dev user.
  if (!config.authEnabled) redirect("/create");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-white">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Sign in to generate and manage your Telugu captions.
      </p>

      <div className="mt-6 space-y-3">
        {config.googleAuth && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/create" });
            }}
          >
            <button className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
              Continue with Google
            </button>
          </form>
        )}
        {config.githubAuth && (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/create" });
            }}
          >
            <button className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">
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
                redirectTo: "/create",
              });
            }}
            className="space-y-2 border-t border-white/10 pt-4"
          >
            <label className="block text-xs text-neutral-500">
              Dev sign-in (email only)
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500">
              Continue
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
