# Phase 4 — Production hardening checklist

App-side pieces (logging, upload rate limits, optional Sentry, strict auth gate)
live in the codebase. Host/ops items below are what you still do by hand.

## A. App code (shipped in repo)

| Item | Status |
|------|--------|
| Structured JSON logs (`src/lib/log.ts`) | Done |
| Job/upload failure → log + optional Sentry | Done |
| `/api/upload` rate limits (min + hour) | Done |
| `STRICT_PROD_AUTH` boot checks | Done |
| Env documented in `.env.example` | Done |

## B. Git / release

- [ ] Commit Phase 4 hardening + product docs
- [ ] Merge `phase3-burned-in-mp4` → `main` (or cut a `release/v1` branch)
- [ ] Tag staging deploy (optional): `git tag staging-$(date +%Y%m%d)`

## C. Managed infra

| Service | Action |
|---------|--------|
| Postgres | Create managed DB; set `DATABASE_URL` |
| Redis | Create managed Redis; set `REDIS_URL`, `QUEUE_DRIVER=bullmq` |
| R2/S3 | Create bucket; set `STORAGE_DRIVER=s3` + `S3_*` |
| App + worker | Two containers/services from same Dockerfile |

Suggested hosts: Railway / Render / Fly (see [DEPLOY.md](../DEPLOY.md)).

## D. Auth + domain

1. Point DNS at the host (HTTPS on).
2. Google Cloud Console → OAuth Web client  
   Redirect: `https://<your-domain>/api/auth/callback/google`
3. Env on **staging/prod**:

```
AUTH_ENABLED=true
AUTH_DEV_LOGIN=false
AUTH_SECRET=<openssl rand -hex 32>
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
STRICT_PROD_AUTH=true
```

## E. Observability + ops

- [ ] Create Sentry project → set `SENTRY_DSN`, `SENTRY_ENVIRONMENT=staging|production`
- [ ] Confirm job failures appear as JSON lines in host logs (`"msg":"job.failed"`)
- [ ] Postgres automated backups (daily) + restore drill once
- [ ] R2/S3 lifecycle: expire incomplete multipart; optional TTL on temp exports
- [ ] Billing alerts: Sarvam + Anthropic monthly spend caps

## F. Staging smoke (definition of done for Phase 4)

On the **staging URL** with auth on:

1. Sign in with Google (dev login disabled)
2. Upload a short Telugu vertical clip
3. Wait until status `done` (worker + Sarvam)
4. Edit one word → blur (spelling learns)
5. Confirm Center Pop + position drag
6. Export burned MP4 and play it

Pass when all six succeed without SSH debugging.

## Local verify before deploy

```bash
# Full stack (auth open via AUTH_DEV_LOGIN unless you override)
docker compose up --build

# Or: force prod-like auth locally (needs Google OAuth + real AUTH_SECRET)
# STRICT_PROD_AUTH=true AUTH_DEV_LOGIN=false AUTH_SECRET=... docker compose up --build
```
