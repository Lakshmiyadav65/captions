# Production environment (Phase 6)

Copy to your host’s secret store — **never commit real values**.
Local dev keeps using `.env` / `.env.local` from `.env.example`.

```bash
# --- Core ---
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@HOST:5432/captions
QUEUE_DRIVER=bullmq
REDIS_URL=redis://...
STORAGE_DRIVER=s3
S3_BUCKET=
S3_REGION=auto
S3_ENDPOINT=                 # R2 / MinIO
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# --- Auth (required for public soft launch) ---
AUTH_ENABLED=true
AUTH_DEV_LOGIN=false
STRICT_PROD_AUTH=true
AUTH_SECRET=                 # openssl rand -hex 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
# Google redirect: https://YOUR_DOMAIN/api/auth/callback/google

# --- ASR ---
ASR_PROVIDER=sarvam
ASR_LANGUAGE=te
SARVAM_API_KEY=
SARVAM_MODE=codemix
OUTPUT_MODE=translit
SUBTITLE_MAX_WORDS=2
# Optional: Whisper word times on top of Sarvam text (extra OPENAI cost)
TIMING_PROVIDER=none

# --- Optional ---
ANTHROPIC_API_KEY=
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN

# --- Caps (tune for soft launch) ---
MAX_UPLOAD_MB=500
MAX_VIDEO_MINUTES=30
QUOTA_MONTHLY_MINUTES=120
QUOTA_MAX_ACTIVE_JOBS=3
RATE_LIMIT_UPLOAD_PER_MINUTE=5
RATE_LIMIT_UPLOAD_PER_HOUR=30
```

Two processes from the same image:

| Service | Command |
|---------|---------|
| Web | `npx prisma db push && npm run start` |
| Worker | `npm run worker` |

Full host notes: [DEPLOY.md](../DEPLOY.md). Soft-launch steps: [09-phase6-launch.md](./09-phase6-launch.md).
