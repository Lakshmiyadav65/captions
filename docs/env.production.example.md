# Production environment — Audience Magazine launch

Copy values into your host secret store / `.env` next to `docker-compose.prod.yml`.
**Never commit real secrets.**

```bash
# --- Core ---
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@HOST/neondb?sslmode=require
# Prefer Neon pooled URL for app; migrations can use DATABASE_URL_UNPOOLED once if needed.

QUEUE_DRIVER=bullmq
REDIS_URL=redis://redis:6379
# On managed Redis (Upstash): rediss://default:...@....upstash.io:6379

STORAGE_DRIVER=s3
S3_BUCKET=telugu-captions-prod
S3_REGION=auto
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=

# --- Auth (required for public launch) ---
AUTH_ENABLED=true
AUTH_DEV_LOGIN=false
STRICT_PROD_AUTH=true
AUTH_SECRET=                 # openssl rand -hex 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
# Google redirect: https://YOUR_DOMAIN/api/auth/callback/google
APP_URL=https://YOUR_DOMAIN

# --- ASR ---
ASR_PROVIDER=sarvam
ASR_LANGUAGE=te
SARVAM_API_KEY=
SARVAM_MODE=codemix
OUTPUT_MODE=translit
SUBTITLE_MAX_WORDS=2
TIMING_PROVIDER=openai

# --- Launch quotas (tight for magazine day) ---
MAX_UPLOAD_MB=100
MAX_VIDEO_MINUTES=5
QUOTA_MONTHLY_MINUTES=90
QUOTA_MAX_ACTIVE_JOBS=2
RATE_LIMIT_UPLOAD_PER_MINUTE=3
RATE_LIMIT_UPLOAD_PER_HOUR=15

# --- Workers ---
WORKER_CONCURRENCY=2
EXPORT_WORKER_CONCURRENCY=1

# --- Observability ---
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=

# --- Optional ---
ANTHROPIC_API_KEY=
```

## Processes

| Service | Command |
|---------|---------|
| Web | `node scripts/use-postgres.mjs && npx prisma migrate deploy && npm run start` |
| Worker | `npm run worker` |

Or: `docker compose -f docker-compose.prod.yml up --build -d`

## Neon already pushed with `db push`?

Baseline the migration once so deploy does not recreate tables:

```bash
$env:DATABASE_URL="postgresql://...unpooled..."
node scripts/use-postgres.mjs
npx prisma migrate resolve --applied 0_init
```

Full host notes: [DEPLOY.md](../DEPLOY.md). Magazine checklist: [11-production-magazine.md](./11-production-magazine.md).
