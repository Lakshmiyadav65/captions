import { redirect } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import { StyleRequestForm } from "@/components/style-request/StyleRequestForm";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth-helpers";

export const metadata = {
  title: "Request a caption style — Caplio (Beta)",
  description:
    "Seen a Reel or Short caption style you love? Upload a reference and we’ll add it to your presets within about 24 hours.",
};

export default async function StyleRequestPage() {
  if (config.authEnabled) {
    const user = await currentUser();
    if (!user) {
      redirect(`/signin?next=${encodeURIComponent("/style-request")}`);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <a href="/#upload" className="text-sky-400 hover:text-sky-300">
            ← Create
          </a>
          <a href="/style-analyzer" className="text-neutral-400 hover:text-neutral-200">
            Analyzer
          </a>
          <a href="/styles" className="text-neutral-400 hover:text-neutral-200">
            My Styles
          </a>
        </nav>
        <UserMenu />
      </header>

      <div className="mb-8 max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
          Beta · 24-hour style
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Get the caption style you want
        </h1>
        <p className="mt-3 text-neutral-400">
          Creators spend hours copying looks from Instagram and YouTube. Tell us the style, upload
          a reference video (or screenshot), and we’ll implement it for you — usually within 24
          hours — so it shows up in your presets.
        </p>
      </div>

      <StyleRequestForm />
    </main>
  );
}
