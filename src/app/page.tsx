import { Uploader } from "@/components/Uploader";
import { UserMenu } from "@/components/UserMenu";

export default function Home() {
  return (
    <>
      <header className="absolute right-0 top-0 z-10 flex items-center gap-4 p-4 text-sm">
        <a href="/style-analyzer" className="text-neutral-400 hover:text-neutral-200">
          Style Analyzer
        </a>
        <a href="/styles" className="text-neutral-400 hover:text-neutral-200">
          My Styles
        </a>
        <UserMenu />
      </header>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Soft launch · Telugu creators
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Telugu Captions
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-neutral-400">
            Upload a Telugu video. Get timed{" "}
            <span className="text-neutral-200">romanized captions</span>, style them
            live (Center Pop by default), and export a{" "}
            <span className="text-neutral-200">publish-ready burned MP4</span> — or
            SRT / VTT / ASS.
          </p>
        </div>

        <Uploader />

        <div className="mt-10 grid grid-cols-1 gap-4 text-sm text-neutral-400 sm:grid-cols-3">
          <Feature
            title="1 · Upload"
            body="Drop a Reel or Short. We extract audio and transcribe Telugu + English code-mix."
          />
          <Feature
            title="2 · Fix & learn"
            body="Edit a wrong word once — we remember it for your next videos."
          />
          <Feature
            title="3 · Export MP4"
            body="Style live, then burn captions into the video ready to post."
          />
        </div>

        <a
          href="/style-analyzer"
          className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-neutral-900/60 p-4 transition hover:border-sky-500/50 hover:bg-neutral-900"
        >
          <div>
            <div className="flex items-center gap-2 font-medium text-neutral-100">
              Caption Style Analyzer
            </div>
            <p className="mt-1 text-neutral-500">
              Drop a screenshot of any Reel caption and reuse that look on yours.
            </p>
          </div>
          <span className="shrink-0 text-sky-400">→</span>
        </a>

        <p className="mt-10 text-center text-xs text-neutral-600">
          Invite-only soft launch. Feedback welcome — especially spelling fixes and
          export look on your usual fonts.
        </p>
      </main>
    </>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-1 font-medium text-neutral-200">{title}</div>
      <p className="text-neutral-500">{body}</p>
    </div>
  );
}
