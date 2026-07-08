# Telugu Captions

Upload a Telugu video → auto-generate **timed Telugu subtitles** → style them live
(font, **size**, colour, outline, background, position) → export a **publish-ready MP4
with the captions burned in**, or download **SRT / VTT / ASS**.

By default subtitles are **romanized** — the spoken Telugu written in English letters, e.g.
"నమస్కారం" → **"Namaskaram"** (`OUTPUT_MODE=translit`). Set `OUTPUT_MODE=transcribe` to get
native Telugu script instead.

Works out of the box with a built-in **sample transcript** (no API key needed to try the
UI). Add a Sarvam or OpenAI key to transcribe real audio.

---

## Quick start

```bash
npm install
npx prisma db push      # creates the local SQLite database
npm run dev             # http://localhost:3000  (uses 3001 if 3000 is busy)
```

Open the app, drop in a video, and you'll land in the editor. With no API key set you'll
see a sample Telugu transcript so you can play with the styling and exports immediately.

> No ffmpeg install required — the ffmpeg binary is bundled via `ffmpeg-static`.

---

## Enable real transcription

Add **one** provider key to `.env` (copy from `.env.example`). The app auto-detects which
key is present; `ASR_PROVIDER=auto` prefers Sarvam.

### Option A — Sarvam (recommended for Telugu)
Tuned for real, code-mixed Telugu speech. ₹1,000 free credits on signup.
1. Get a key: https://dashboard.sarvam.ai
2. In `.env`:
   ```
   ASR_PROVIDER=sarvam
   SARVAM_API_KEY=your_key_here
   ```

### Option B — OpenAI (cheapest / easiest)
1. Get a key: https://platform.openai.com/api-keys
2. In `.env`:
   ```
   ASR_PROVIDER=openai
   OPENAI_API_KEY=your_key_here
   ```

Restart `npm run dev` after editing `.env`. Set `ASR_LANGUAGE=auto` if you want the spoken
language detected instead of assuming Telugu.

---

## How it works

```
Upload (streamed to disk)
  → ffmpeg extracts 16 kHz mono audio          (src/lib/ffmpeg.ts)
  → audio is chunked if longer than the provider's limit
  → transcription provider returns timed words/segments
      · Sarvam: word timestamps → grouped into subtitle lines
      · OpenAI (whisper-1): segment timestamps directly
  → segments normalized to one Segment[] model  (src/lib/transcription/*)
  → stored in SQLite via Prisma
Editor
  → HTML5 video + live subtitle overlay (rAF-synced)
  → optional word-by-word karaoke highlight (progressive fill, preview = export)
  → custom spelling dictionary fixes recurring ASR mistakes (auto-applied to new videos)
  → style panel drives one SubtitleStyle
  → SRT / VTT / ASS generated client-side from segments + style
  → "Export MP4" burns captions into the video server-side   (src/lib/ffmpeg.ts)
      · builds ASS from the live segments + style
      · ffmpeg `subtitles` (libass) renders them into H.264/AAC + faststart
      · bundled Telugu TTFs in assets/fonts let libass match the chosen font
```

Swapping transcription vendors is a one-file change: implement `TranscriptionProvider`
(`src/lib/transcription/types.ts`) and register it in `index.ts`. Google Chirp / ElevenLabs
Scribe / local faster-whisper all fit this interface.

---

## Project structure

| Path | What |
|------|------|
| `src/app/` | Pages (`/`, `/jobs/[id]`) + API routes (`upload`, `jobs`, `transcript`) |
| `src/lib/transcription/` | Provider interface + Sarvam / OpenAI / mock adapters |
| `src/lib/ffmpeg.ts` | Audio extraction, chunking & **burned-in MP4** rendering (bundled ffmpeg) |
| `src/app/api/export/[id]/` | Server-side "Export MP4" — burns ASS captions into the video |
| `assets/fonts/` | Bundled Telugu TTFs libass uses when burning (browser fonts are woff2-only) |
| `src/lib/jobs.ts` | In-process job worker + status transitions |
| `src/lib/subtitles/` | SRT / VTT / ASS exporters + the `SubtitleStyle` model |
| `src/lib/fonts.ts` | Curated self-hosted Telugu fonts |
| `src/components/` | `Uploader`, `PreviewStage`, `SubtitleOverlay`, `StylePanel`, `SubtitleList`, `Editor` |
| `src/lib/storage/`, `src/lib/queue/` | Storage (local/S3) + queue (inline/BullMQ) adapters |
| `src/lib/auth.ts`, `config.ts`, `quota.ts` | Auth.js, env feature-flags, per-user quotas |
| `prisma/schema.prisma` | `Job`, `Transcript`, `StylePreset`, `User`/`Account`/`Session` |
| `Dockerfile`, `docker-compose.yml`, `DEPLOY.md` | Production deploy (app + worker + Postgres + Redis) |

---

## Production & hosting (Phase 2)

The app scales up via **environment variables — no code changes**. Full guide: **[DEPLOY.md](DEPLOY.md)**.

| Concern | Local default | Production |
|---|---|---|
| Database | SQLite | Postgres (`DATABASE_URL`) |
| Storage | local disk (`./storage`) | S3 / R2 (`STORAGE_DRIVER=s3`) |
| Queue | in-process | BullMQ + Redis (`QUEUE_DRIVER=bullmq` + `npm run worker`) |
| Auth | off (single dev user) | Google / GitHub OAuth (`AUTH_ENABLED=true`) |

Run the whole stack locally with Docker: `docker compose up --build` (Postgres + Redis + app +
worker). Per-user **quotas** (monthly minutes, concurrent jobs) and **upload caps** (size,
duration) are enforced server-side via `MAX_UPLOAD_MB`, `MAX_VIDEO_MINUTES`, `QUOTA_*`.

## Notes & limitations

- **Telugu ASR is imperfect** (WER ~33–46%). The built-in transcript **editor** lets you fix
  wording and timings — clean source audio helps a lot.
- Local dev uses the in-process queue (not crash-safe); use `QUEUE_DRIVER=bullmq` + a worker in
  production.
- Cloud transcription sends audio to the provider. A local `faster-whisper` provider (fully
  private/offline) is on the Phase 3 roadmap.

## Roadmap

- **Phase 2 (done):** Postgres, S3/R2 storage, BullMQ + Redis queue + worker, Auth.js accounts,
  quotas + caps, Dockerfile + docker-compose + deploy docs.
- **Phase 3 (in progress):** ✅ burned-in MP4 export (ffmpeg + ASS); ✅ word-by-word
  **karaoke** highlighting (progressive fill, live + burned); ✅ custom **spelling dictionary**
  (persistent per-user corrections, auto-applied to new videos). Next: waveform/timeline
  editor, more ASR providers (Google Chirp, ElevenLabs), local faster-whisper toggle,
  custom font upload.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 6 (SQLite → Postgres) ·
Auth.js (NextAuth v5) · BullMQ + Redis · AWS SDK (S3/R2) · ffmpeg-static · @fontsource Telugu fonts.
