import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth-helpers";
import { signOut } from "@/lib/auth";

// Shown only when auth is enabled. Server component: reads the session and renders a
// sign-out action, or a sign-in link.

export async function UserMenu() {
  if (!config.authEnabled) return null;
  const user = await currentUser();

  if (!user) {
    return (
      <a href="/signin" className="text-sm text-sky-400 hover:text-sky-300">
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-neutral-400">{user.email ?? user.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-1.5 text-neutral-200 hover:bg-neutral-700">
          Sign out
        </button>
      </form>
    </div>
  );
}
