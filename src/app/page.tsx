import { Uploader } from "@/components/Uploader";
import { UserMenu } from "@/components/UserMenu";

export default function Home() {
  return (
    <>
      <header className="absolute right-0 top-0 z-10 p-4">
        <UserMenu />
      </header>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          తెలుగు · AI subtitle generator
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Telugu Captions
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-neutral-400">
          Upload a Telugu video. We detect the speech, generate timed Telugu
          subtitles, and let you style them live — font, size, colour, outline and
          position — then export SRT, VTT or ASS.
        </p>
      </div>

      <Uploader />

      <div className="mt-10 grid grid-cols-1 gap-4 text-sm text-neutral-400 sm:grid-cols-3">
        <Feature title="1 · Upload" body="Drop any Telugu video. Audio is extracted automatically." />
        <Feature title="2 · Transcribe" body="Speech is detected and converted to timed Telugu subtitles." />
        <Feature title="3 · Style & export" body="Adjust fonts and sizes live, then download subtitle files." />
      </div>

      <p className="mt-10 text-center text-xs text-neutral-600">
        Works out of the box with a sample transcript. Add a Sarvam or OpenAI API key
        for real transcription — see the README.
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
