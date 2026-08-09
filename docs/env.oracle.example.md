# Oracle Always Free — env template

Copy to `.env` on the VM (next to `docker-compose.prod.yml`):

```bash
cp docs/env.oracle.example.md .env
```

**Never commit real secrets.**

```bash
NODE_ENV=production

# Neon (reuse the same project as Vercel — pooled URL is fine for app+worker)
DATABASE_URL=postgresql://USER:PASS@HOST/neondb?sslmode=require

QUEUE_DRIVER=bullmq
# Override only if Redis isn’t the compose service named "redis"
# REDIS_URL=redis://redis:6379

# Phase A: local disk on the VM (compose mounts /data/storage)
STORAGE_DRIVER=local
# Phase C: switch to R2
# STORAGE_DRIVER=s3
# S3_BUCKET=telugu-captions-prod
# S3_REGION=auto
# S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_PUBLIC_BASE_URL=

# First smoke (IP). Later: https://captions.yourdomain.com
APP_URL=http://YOUR_PUBLIC_IP:3000
# APP_DOMAIN=captions.yourdomain.com

AUTH_ENABLED=true
# Phase A smoke: false is OK on a private IP. Before public invite → true + Google.
STRICT_PROD_AUTH=false
AUTH_DEV_LOGIN=true
AUTH_SECRET=                 # openssl rand -hex 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

ASR_PROVIDER=sarvam
ASR_LANGUAGE=te
OUTPUT_MODE=translit
SARVAM_API_KEY=
SARVAM_MODE=codemix
SARVAM_MODEL=saaras:v4
TIMING_PROVIDER=openai

MAX_UPLOAD_MB=100
MAX_VIDEO_MINUTES=5
QUOTA_MONTHLY_MINUTES=120
QUOTA_MAX_ACTIVE_JOBS=3
RATE_LIMIT_UPLOAD_PER_MINUTE=5
RATE_LIMIT_UPLOAD_PER_HOUR=30

WORKER_CONCURRENCY=1
EXPORT_WORKER_CONCURRENCY=1

SENTRY_DSN=
SENTRY_ENVIRONMENT=production
```

Full magazine quotas / R2 notes: [env.production.example.md](./env.production.example.md)  
VM steps: [13-oracle-always-free.md](./13-oracle-always-free.md)
