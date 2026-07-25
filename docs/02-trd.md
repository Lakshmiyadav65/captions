# 02 — TRD: Technical Requirements Document

**Product:** Telugu Captions  
**Rule for agents:** Do not invent a new stack. Extend adapters below. Prefer env-driven swaps over rewrites.

---

## Frontend

| Choice | Detail |
|--------|--------|
| Framework | **Next.js 16** (App Router) + **React 19** + **TypeScript** |
| Styling | **Tailwind CSS v4** |
| Fonts (UI) | `@fontsource/*` Telugu families (Noto, NTR, Mandali, …) |
| Fonts (burn) | TTFs in `assets/fonts/` for libass |
| State | React local state + SSE for job progress; no Redux |
| Validation | **Zod** for env (`src/lib/config.ts`) |

Key UI modules: `Editor`, `PreviewStage`, `SubtitleOverlay`, `StylePanel`, `SubtitleList`, Style Analyzer components.

---

## Backend / runtime

| Choice | Detail |
|--------|--------|
| API | Next.js Route Handlers (`src/app/api/**`) |
| Worker | `npm run worker` → `src/worker.ts` (BullMQ consumer) |
| Media | Bundled **ffmpeg-static** (extract, chunk, burn) |
| ORM | **Prisma 6** |

Processing pipeline: upload → queue → `processJob` → extract audio → energy chunk → ASR → romanize → spelling → short frames → persist transcript.

---

## Database

| Env | Provider |
|-----|----------|
| Local | **SQLite** `file:./dev.db` |
| Production | **PostgreSQL** (`DATABASE_URL=postgresql://…`) |

Switch via `scripts/use-postgres.mjs` / Docker build. Schema: [05 Backend Schema](./05-backend-schema.md).

---

## Auth

| Mode | Behavior |
|------|----------|
| `AUTH_ENABLED=false` | Single auto **local@dev** user (quotas still apply) |
| `AUTH_ENABLED=true` | **Auth.js (NextAuth v5)** + Prisma adapter |
| Providers | Google OAuth (primary prod); optional GitHub; **disable** `AUTH_DEV_LOGIN` in prod |

---

## Storage

| Driver | Use |
|--------|-----|
| `local` | `./storage` (dev / single host) |
| `s3` | AWS S3 / Cloudflare **R2** / MinIO — uploads + screenshots; playback via presigned URLs |

Keys like `uploads/<jobId>/source.mp4`.

---

## Job queue

| Driver | Use |
|--------|-----|
| `inline` | Process in web process (dev only) |
| `bullmq` | Redis + separate `worker` (production) |

---

## Third-party APIs

| Service | Purpose | Notes |
|---------|---------|-------|
| **Sarvam** `saaras:v3` | Telugu / codemix ASR | Prefer `SARVAM_MODE=codemix`; sync cap ~28s → chunk |
| **OpenAI** whisper-1 | Optional ASR | Fallback / timing experiments |
| **Anthropic** Claude | Style Analyzer vision + caption generation | Mock if no key |
| Google OAuth | Sign-in | Prod auth |

---

## Key libraries

- `@indic-transliteration/sanscript` — Telugu → Latin runs  
- `bullmq` + `ioredis` — queue  
- `@aws-sdk/client-s3` — object storage  
- `@anthropic-ai/sdk` — vision / captions  
- `ffmpeg-static` — media  

---

## Folder structure (conventions)

```
src/app/                 # pages + API routes
src/components/          # UI (Editor, styles, analyzer)
src/lib/
  transcription/         # ASR providers + util
  subtitles/             # SRT/VTT/ASS + SubtitleStyle
  storage/               # local | s3 adapters
  queue/                 # inline | bullmq
  vision/ caption/       # style analyzer
  spelling.ts            # pure apply/diff rules
  processor.ts           # job pipeline
prisma/schema.prisma
assets/fonts/            # TTFs for burn
docs/                    # these product docs
```

Naming: `camelCase` TS, Prisma models PascalCase, storage keys kebab path segments.

---

## Environment variables (names only)

See `.env.example`. Critical for production:

`DATABASE_URL`, `AUTH_ENABLED`, `AUTH_SECRET`, `AUTH_GOOGLE_*`, `AUTH_DEV_LOGIN=false`,  
`ASR_PROVIDER`, `SARVAM_API_KEY`, `SARVAM_MODE`, `OUTPUT_MODE`, `TIMING_PROVIDER`,  
`STORAGE_DRIVER`, `S3_*`, `QUEUE_DRIVER`, `REDIS_URL`,  
`MAX_UPLOAD_MB`, `MAX_VIDEO_MINUTES`, `QUOTA_*`,  
`RATE_LIMIT_UPLOAD_PER_MINUTE`, `RATE_LIMIT_UPLOAD_PER_HOUR`,  
`SENTRY_DSN`, `STRICT_PROD_AUTH`,  
`ANTHROPIC_API_KEY` (optional), `VISION_*`, `CAPTION_*`

Never commit `.env` or API keys.

---

## Hard constraints

1. **Not serverless-only** — ffmpeg burn + long ASR need containers + CPU.  
2. Preview and ASS must share one `SubtitleStyle` model (`src/lib/subtitles/style.ts`).  
3. Browser must never import Prisma (`spelling-server.ts` stays server-only).  
4. Portrait video: use real `width`/`height` for preview + `PlayRes` in ASS.  
5. Prefer adapter pattern over forking pipelines for new ASR vendors.

---

## Hosting (production)

| Layer | Recommendation |
|-------|----------------|
| App + worker | Railway / Render / Fly.io (Docker) |
| DB | Managed Postgres |
| Redis | Managed (Upstash / host plugin) |
| Objects | Cloudflare R2 or S3 |
| CDN | Optional via `S3_PUBLIC_BASE_URL` |

Details: [DEPLOY.md](../DEPLOY.md).
