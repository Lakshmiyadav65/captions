# Deploy Telugu Captions on Railway (chosen host)

Stack on Railway:

| Service | Role |
|---------|------|
| **web** | Next.js + API (`railway.json` start command) |
| **worker** | BullMQ consumer — transcription + MP4 export |
| **Redis** | Railway Redis plugin → `REDIS_URL` |

Keep **Neon** (external `DATABASE_URL`) and **Cloudflare R2** (S3-compatible). Do not use Railway volume disk for videos.

---

## 1. One-time accounts (parallel)

1. **Railway** — https://railway.app → sign in with GitHub  
2. **Cloudflare R2** — create bucket `telugu-captions-prod`, create API token (Object Read & Write), note Account ID → endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`  
3. **Google Cloud** — OAuth 2.0 Web client; you’ll add the Railway URL as redirect after first deploy  
4. **Sentry** — Node/Next project → copy DSN  
5. **Neon** — already have `DATABASE_URL` (Vercel/Neon); reuse the **pooled** URL for app + worker  

Neon migration already baselined (`0_init`). Fresh migrate deploy on Railway is safe.

---

## 2. Create the Railway project

In Railway dashboard (or CLI):

1. **New Project** → **Deploy from GitHub** → `Lakshmiyadav65/captions` (repo)  
2. Railway detects `Dockerfile` + `railway.json` → this is the **web** service  
3. **Add Plugin** → **Redis** (wait until `REDIS_URL` appears)  
4. **Add Service** → **GitHub Repo** → same `captions` repo → rename to **worker**  
   - Settings → Custom Start Command:  
     `npm run worker`  
   - Same Dockerfile build as web  

Both services must share the same env vars below (Railway: share variables / copy to project).

---

## 3. Environment variables

Set on **web** and **worker** (Redis plugin usually injects `REDIS_URL` automatically — reference it on both services).

```bash
NODE_ENV=production

# Neon (paste your real URL)
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require

QUEUE_DRIVER=bullmq
REDIS_URL=${{Redis.REDIS_URL}}   # Railway variable reference to the Redis service

STORAGE_DRIVER=s3
S3_BUCKET=telugu-captions-prod
S3_REGION=auto
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

AUTH_ENABLED=true
AUTH_DEV_LOGIN=false
STRICT_PROD_AUTH=true
AUTH_SECRET=                 # openssl rand -hex 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
APP_URL=https://YOUR_RAILWAY_DOMAIN

ASR_PROVIDER=sarvam
ASR_LANGUAGE=te
OUTPUT_MODE=translit
SARVAM_API_KEY=
SARVAM_MODE=codemix
TIMING_PROVIDER=openai

MAX_UPLOAD_MB=100
MAX_VIDEO_MINUTES=5
QUOTA_MONTHLY_MINUTES=90
QUOTA_MAX_ACTIVE_JOBS=2
RATE_LIMIT_UPLOAD_PER_MINUTE=3
RATE_LIMIT_UPLOAD_PER_HOUR=15

WORKER_CONCURRENCY=2
EXPORT_WORKER_CONCURRENCY=1

SENTRY_DSN=
SENTRY_ENVIRONMENT=production
```

Generate `AUTH_SECRET`:

```bash
openssl rand -hex 32
```

---

## 4. Networking

1. Web service → **Settings → Networking → Generate domain** (e.g. `captions-production-xxxx.up.railway.app`)  
2. Set `APP_URL` to `https://that-domain`  
3. Google OAuth → Authorized redirect URI:  
   `https://that-domain/api/auth/callback/google`  
4. Later: custom domain (Audience Magazine) → update `APP_URL` + Google redirect  

Health: `https://YOUR_DOMAIN/api/health` → `{"ok":true,"db":"ok",...}`

---

## 5. CLI (optional)

```bash
# Login once (browser)
railway login

# Link this repo to the Railway project
railway link

# Deploy web (from repo root)
railway up

# Open logs
railway logs
```

Create/configure the **worker** service in the dashboard (same image, `npm run worker`) if the CLI linked only one service.

---

## 6. Smoke test

1. `/api/health` → db ok  
2. Sign in with Google  
3. Upload a short Telugu portrait clip → job reaches `done`  
4. Export MP4 → worker logs show `export.started` / `export.completed`  
5. Confirm file plays from R2/presigned URL  

Worker logs must show: `worker.listening` with queues `transcription` and `export`.

---

## 7. Scale on launch day

- Queue backed up → duplicate **worker** service or raise `WORKER_CONCURRENCY` carefully  
- Keep `EXPORT_WORKER_CONCURRENCY=1` per instance (ffmpeg is heavy); add more worker replicas instead  

See runbooks in [11-production-magazine.md](./11-production-magazine.md).
