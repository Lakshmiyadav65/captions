# Telugu Captions

Upload a Telugu video → **timed romanized captions** → style them live → export a
**publish-ready burned MP4** (or SRT / VTT / ASS).

English words in code-mix speech stay English; Telugu becomes readable Latin letters
(e.g. "నమస్కారం" → **"Namaskaram"**). Default look is **Center Pop**. Edits auto-teach
spelling for your next videos.

**Soft launch:** invite-only. Product docs live in [`docs/`](docs/README.md).  
**Live URL:** _(set after deploy — see [`docs/09-phase6-launch.md`](docs/09-phase6-launch.md))_

---

## Quick start (local)

```bash
npm install
npx prisma db push      # creates the local SQLite database
npm run dev             # http://localhost:3000  (uses 3001 if 3000 is busy)
```

Open the app, drop in a video. With no API key you’ll get a sample transcript so you can
style and export immediately.

> No ffmpeg install required — the binary is bundled via `ffmpeg-static`.

---

## Enable real transcription

Add **one** provider key to `.env` (copy from `.env.example`). `ASR_PROVIDER=auto` prefers Sarvam.

### Option A — Sarvam (recommended for Telugu)
1. Key: https://dashboard.sarvam.ai  
2. `.env`:
   ```
   ASR_PROVIDER=sarvam
   SARVAM_API_KEY=your_key_here
   SARVAM_MODE=codemix
   OUTPUT_MODE=translit
   ```

### Option B — OpenAI
```
ASR_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

Restart `npm run dev` after editing `.env`.

---

## How it works

```
Upload → extract audio → energy chunk → ASR (Sarvam/OpenAI/mock)
  → romanize Telugu runs → spelling (built-in + your learned rules)
  → short caption frames → editor (Center Pop, drag position)
  → Export MP4 (ffmpeg + bundled Telugu TTFs) or SRT/VTT/ASS
```

Adapters swap via env: SQLite→Postgres, local→S3/R2, inline→BullMQ, auth off→Google OAuth.
Details: **[DEPLOY.md](DEPLOY.md)**.

---

## Soft launch / production

1. Follow **[docs/09-phase6-launch.md](docs/09-phase6-launch.md)**  
2. Env template: **[docs/env.production.example.md](docs/env.production.example.md)**  
3. Hosting: Railway / Render / Fly (app **+** worker) — not serverless-only  

When the public URL is live, put it at the top of this README and in the Phase 6 doc.

---

## Project structure

| Path | What |
|------|------|
| `src/app/` | Pages + API routes |
| `src/lib/transcription/` | Sarvam / OpenAI / mock |
| `src/lib/processor.ts` | Job pipeline |
| `src/lib/spelling.ts` | Built-in + learnable corrections |
| `src/lib/subtitles/` | Style model + SRT/VTT/ASS |
| `assets/fonts/` | TTFs for burned MP4 |
| `docs/` | PRD → launch checklists (01–09) |
| `Dockerfile`, `docker-compose.yml` | Prod stack |

---

## Notes

- Telugu ASR is imperfect — the editor + auto-learn spelling are part of the product.
- Soft-launch quotas: monthly minutes + concurrent jobs (`QUOTA_*`).
- Roadmap after launch: better word timings, Stripe, more Indic languages (`docs/06`).

## Tech

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Prisma 6 · Auth.js · BullMQ · S3/R2 · ffmpeg-static.
