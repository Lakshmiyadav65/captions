# Audience Magazine — production launch checklist

Target stack: **Railway** (web + worker + Redis) + **Neon Postgres** + **Cloudflare R2** + **BullMQ**.  
Do **not** put magazine traffic on Vercel Hobby for processing.

Railway step-by-step: [12-railway-deploy.md](./12-railway-deploy.md).

Live demo (Neon only): https://captions-gilt.vercel.app — keep for marketing; processing for launch goes on the container host.

---

## Decisions (locked)

| Area | Choice |
|------|--------|
| Host | **Railway** (web + worker + Redis plugin) — see [12-railway-deploy.md](./12-railway-deploy.md) |
| DB | Keep Neon (already provisioned for this project) |
| Media | Cloudflare R2 (`STORAGE_DRIVER=s3`) |
| Queue | BullMQ + Redis; web enqueues, worker burns ASR + export |
| Auth | Google OAuth; `AUTH_DEV_LOGIN=false`; `STRICT_PROD_AUTH=true` |
| Quotas | 100 MB / 5 min video / 90 min/mo / 2 active jobs / 3 upl/min |
| Observability | Sentry DSN required before open invite |

---

## Infra checklist

- [ ] **Railway** project live: **web** + **worker** + **Redis** ([12-railway-deploy.md](./12-railway-deploy.md))
- [ ] Neon `DATABASE_URL` set on web + worker
- [ ] If Neon was created via `db push`, migration `0_init` already resolved (done for current Neon)
- [ ] Redis healthy (`REDIS_URL` from Railway Redis plugin)
- [ ] R2 bucket + keys; `STORAGE_DRIVER=s3` smoke: upload → play → export
- [ ] Worker logs show `worker.listening`
- [ ] Railway domain (or custom domain) + HTTPS
- [ ] `APP_URL` matches public HTTPS origin

## Security checklist

- [ ] `AUTH_ENABLED=true`
- [ ] `AUTH_DEV_LOGIN=false`
- [ ] `STRICT_PROD_AUTH=true`
- [ ] Google OAuth client; redirect `https://YOUR_DOMAIN/api/auth/callback/google`
- [ ] Secrets only in host env (never git)
- [ ] Launch quotas/rate limits from [env.production.example.md](./env.production.example.md)

## Product checklist

- [ ] Portrait Telugu clip E2E on **production** URL
- [ ] Landscape Telugu clip E2E
- [ ] Export MP4 for ~60s clip finishes in under ~2–3 minutes
- [ ] Failed job → Retry works
- [ ] Sentry receives a test error / real failure

## Ops checklist

- [ ] Budget alerts: Sarvam, host, R2
- [ ] Runbook below bookmarked for on-call
- [ ] Discord/status channel for ASR outages

---

## Deploy commands

```bash
# 1. Fill .env from env.production.example.md (Neon URL, R2, AUTH_*, SARVAM, SENTRY)
# 2. Build & start
docker compose -f docker-compose.prod.yml up --build -d

# 3. Logs
docker compose -f docker-compose.prod.yml logs -f app worker
```

Smoke:

1. Sign in with Google  
2. Upload a short Telugu Reel  
3. Wait until job `done`  
4. Export MP4; download plays with captions  

---

## Runbook: queue backed up

Symptoms: many jobs stuck in `queued` / `extracting`; uploads succeed but captions never finish; export hangs.

1. Confirm worker is up: `docker compose -f docker-compose.prod.yml ps` and logs for `worker.listening`
2. Confirm Redis: `redis-cli -u $REDIS_URL ping`
3. Scale workers (CPU/ASR limited — start conservatively):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --scale worker=2
   ```
   Or raise `WORKER_CONCURRENCY` / `EXPORT_WORKER_CONCURRENCY` and recreate worker.
4. Check Sarvam status / API key quota if jobs fail at `transcribing`
5. Check R2 credentials if jobs fail at upload/store
6. If export queue is deep, keep `EXPORT_WORKER_CONCURRENCY=1` per box and add boxes before raising concurrency (ffmpeg is CPU-heavy)

## Runbook: ASR down

1. Post status to Discord: “Captions delayed — transcription provider issue”
2. Jobs will fail with provider errors; users can Retry after recovery
3. Do not flip `ASR_PROVIDER=mock` on production URL

## Runbook: export timeouts

1. Confirm export is on the worker (`export.started` / `export.completed` in worker logs), not only the web process
2. Prefer shorter clips (`MAX_VIDEO_MINUTES=5`) at launch
3. Scale export workers horizontally before raising concurrency on one machine

---

## What stays on Vercel

Optional marketing/demo. Magazine creators should use the **container** URL with auth + R2 + workers.

---

## Account setup (you do these)

1. **Cloudflare R2** — create bucket `telugu-captions-prod`, API token with Object R/W; paste into `.env`
2. **Google Cloud Console** — OAuth Web client; add prod redirect URI
3. **Sentry** — create project; paste `SENTRY_DSN`
4. **Host** — Railway/Fly/Render: connect repo or deploy compose; set all env vars; attach domain
5. **Baseline Neon migration** if tables already exist from earlier `db push` (see above)

When those five are done, re-run the Infra/Security/Product checklists on the real domain.
