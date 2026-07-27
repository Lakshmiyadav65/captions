# Deploying Telugu Captions (Phase 2)

The app is built around **swappable adapters** so it runs on zero infra locally and scales
up purely via environment variables:

| Concern | Local default | Production |
|---|---|---|
| Database | SQLite (`file:./dev.db`) | Postgres (`DATABASE_URL=postgresql://…`) |
| Storage | Local disk (`./storage`) | S3 / R2 (`STORAGE_DRIVER=s3`) |
| Job queue | In-process (`inline`) | BullMQ + Redis (`QUEUE_DRIVER=bullmq` + worker) |
| Auth | Off / dev email | Google OAuth (`AUTH_ENABLED=true`) |

---

## Run the full stack locally with Docker

```bash
# 1. Put secrets in .env next to docker-compose.yml (AUTH_SECRET, ASR keys…)
echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env
echo "ASR_PROVIDER=sarvam"                 >> .env
echo "SARVAM_API_KEY=your_key"             >> .env

# 2. Bring up Postgres + Redis + app + worker
docker compose up --build
# → http://localhost:3000
```

This starts four services (see `docker-compose.yml`): `postgres`, `redis`, `app`
(web), and `worker` (BullMQ consumer). The app and worker share a `media` volume for
local storage; switch to S3/R2 for multi-host.

---

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Postgres URL in prod |
| `ASR_PROVIDER` | `auto` | `sarvam` \| `openai` \| `mock` |
| `ASR_LANGUAGE` | `te` | or `auto` to detect |
| `SARVAM_API_KEY` / `OPENAI_API_KEY` | — | transcription |
| `TIMING_PROVIDER` | `none` | `openai` = Whisper word times on top of primary ASR text (needs `OPENAI_API_KEY`; extra $/min) |
| `STORAGE_DRIVER` | `local` | `s3` for production |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` | — | R2/MinIO need `S3_ENDPOINT` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | omit to use IAM role |
| `QUEUE_DRIVER` | `inline` | `bullmq` for a separate worker |
| `REDIS_URL` | — | required for bullmq |
| `AUTH_ENABLED` | `false` | gate the app behind sign-in |
| `AUTH_SECRET` | — | **required** in prod (`openssl rand -hex 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | — | enables Google sign-in |
| `AUTH_DEV_LOGIN` | `true` | email-only sign-in; **set `false` in prod** |
| `MAX_UPLOAD_MB` | `500` | reject larger uploads |
| `MAX_VIDEO_MINUTES` | `30` | reject longer videos |
| `QUOTA_MONTHLY_MINUTES` | `120` | per-user monthly cap |
| `QUOTA_MAX_ACTIVE_JOBS` | `3` | per-user concurrency |
| `RATE_LIMIT_UPLOAD_PER_MINUTE` | `5` | burst cap on `/api/upload` |
| `RATE_LIMIT_UPLOAD_PER_HOUR` | `30` | hourly upload cap |
| `SENTRY_DSN` | — | optional; reports job/upload failures |
| `STRICT_PROD_AUTH` | `false` | **set `true` on staging/prod** — blocks weak auth |
| `FONTS_DIR` | `./assets/fonts` | TTFs libass burns into MP4 exports; override if relocated |

> **MP4 export & fonts:** "Export MP4" burns captions server-side with the bundled ffmpeg.
> libass needs real TTF/OTF files (the browser `@fontsource` fonts are woff2-only), so the
> repo ships them in `assets/fonts/`. The Docker image already copies them; on other hosts
> ensure that directory is deployed (or point `FONTS_DIR` at it). Burning re-encodes the
> video — CPU-bound — so keep it on the web/container host, not a serverless function.

---

## Deploy production (Audience Magazine)

**Host: Railway** — see [`docs/12-railway-deploy.md`](docs/12-railway-deploy.md).

Use the Dockerfile + `railway.json` (web). Add a second service for **worker** (`npm run worker`) and a **Redis** plugin. Postgres stays on **Neon**; media on **Cloudflare R2**.

Checklist + runbooks: [`docs/11-production-magazine.md`](docs/11-production-magazine.md).

Local / VPS alternative:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Web applies `prisma migrate deploy` on boot. Worker runs transcription **and** MP4 export burns via BullMQ.

## Deploy on Vercel (Hobby) — demos only

The earlier build failure (`maxDuration` 600) is fixed — export is capped at **300s** (Hobby max).

1. **Project → Settings → Environment Variables** (Production **and** Build), set at least:
   - `DATABASE_URL` — **Postgres** (Neon / Vercel Postgres / Supabase). SQLite will not work on Vercel.
     Enable the variable for **Production** and **Build** (missing at build time used to leave a SQLite Prisma client).
   - `AUTH_SECRET` — `openssl rand -hex 32`
   - ASR keys (`SARVAM_API_KEY` or `OPENAI_API_KEY`) as needed
   - For durable uploads/exports: `STORAGE_DRIVER=s3` + S3/R2 vars (local disk is ephemeral on serverless)
2. Connect the GitHub repo; push to `main` redeploys automatically.
3. After first deploy with Postgres: run `npx prisma db push` against that `DATABASE_URL` once (local machine or Vercel CLI) so tables exist.
4. Smoke-check: open `/api/health` — expect `{ "ok": true, "db": "ok" }`. If `db` is `"error"`, uploads will keep failing until Postgres + `db push` are fixed.

`vercel.json` runs `scripts/vercel-build.mjs`, which switches Prisma to Postgres when `DATABASE_URL` is a `postgres://` URL, then `prisma generate` + `next build`.

**Limits:** Hobby serverless functions max out at 300s / limited CPU. Long “Export video” jobs may still time out — for heavy burns prefer Docker (`docker compose`) or a Pro plan / dedicated worker.

## Storage: S3 / Cloudflare R2

```
STORAGE_DRIVER=s3
S3_BUCKET=telugu-captions
S3_REGION=auto
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # R2/MinIO only; omit for AWS
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```
Playback uses **presigned URLs** (the browser streams straight from the bucket).

## Auth: Google OAuth

For the live Vercel audience app, follow the step-by-step checklist:

→ [`docs/14-production-google-oauth.md`](docs/14-production-google-oauth.md)

Summary:

1. Google Cloud Console → OAuth 2.0 Client (Web).
2. Redirect URI: `https://captions-gilt.vercel.app/api/auth/callback/google`
   (or `https://your-domain/api/auth/callback/google`).
3. Set `AUTH_ENABLED=true`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`,
   `AUTH_DEV_LOGIN=false`, and `AUTH_URL`/`APP_URL` to the public site URL.
4. On real staging/prod also set `STRICT_PROD_AUTH=true` so the app **refuses to boot**
   if dev login is still on or `AUTH_SECRET` is missing/placeholder.

---

## Phase 4: observability

- Logs are one JSON object per line (`msg`, `level`, `jobId`, …). Search host logs for
  `"job.failed"` / `"upload.rate_limited"`.
- Optional: create a Sentry project and set `SENTRY_DSN` (+ `SENTRY_ENVIRONMENT`).
- Staging smoke + infra checklist: [`docs/07-phase4-checklist.md`](docs/07-phase4-checklist.md).

---

## Deploy to a container host

Video upload + long transcription exceed serverless limits, so use a **container host**
(not Vercel). All of these build the `Dockerfile`:

- **Oracle Always Free (Ampere VM)** — $0 path: `docker-compose.prod.yml` + `docker-compose.oracle.yml`; see [`docs/13-oracle-always-free.md`](docs/13-oracle-always-free.md).
- **Railway** — Redis plugin; web (`npm run start`) + worker (`npm run worker`); see [`docs/12-railway-deploy.md`](docs/12-railway-deploy.md).
- **Render** — Web Service + Background Worker + Redis.
- **Fly.io** — `fly launch`; Redis; second process/machine for the worker.

Keep **Neon Postgres** as `DATABASE_URL`. Prefer **Cloudflare R2** for media (`STORAGE_DRIVER=s3`); on a single Oracle VM you can start with local disk (`STORAGE_DRIVER=local`) then move to R2.

The Docker build switches Prisma to Postgres (`scripts/use-postgres.mjs`). Prod compose runs `prisma migrate deploy` on boot.

## Scaling notes

- Scale the **worker** horizontally for more transcription throughput (BullMQ distributes).
- Use **S3/R2** once you run more than one instance (local disk isn't shared).
- Consider migrating `prisma db push` → real migrations (`prisma migrate`) before you
  have production data you can't lose.
