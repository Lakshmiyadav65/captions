import { UserMenu } from "@/components/UserMenu";
import { StyleAnalyzer } from "@/components/style-analyzer/StyleAnalyzer";

export const metadata = {
  title: "Caption Style Analyzer — Telugu Captions",
  description:
    "Upload a Reel/Short caption screenshot, extract its visual style, and reuse it on your own Telugu captions.",
};

export default function StyleAnalyzerPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-4 text-sm">
          <a href="/" className="text-sky-400 hover:text-sky-300">
            ← Home
          </a>
          <a href="/styles" className="text-neutral-400 hover:text-neutral-200">
            My Styles
          </a>
        </nav>
        <UserMenu />
      </header>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Caption Style Analyzer
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-400">
          Drop a screenshot of any Reel or Short caption. The AI reads its{" "}
          <span className="text-neutral-300">design language</span> — font, colors, layout and
          effects — and recreates the look for brand-new Telugu captions. It never copies the
          original text.
        </p>
      </div>

      <StyleAnalyzer />
    </main>
  );
}
