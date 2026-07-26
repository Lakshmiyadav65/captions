# 06 — Implementation Plan: Build & Production Sequence

**Product:** Telugu Captions  
**Current state:** Core product built on `phase3-burned-in-mp4`. This plan is the **production ship checklist** + remaining work — agents should not rebuild Phase 1–3 from scratch.

---

## Phase 0 — Source of truth (done when docs land)

- [x] PRD / TRD / Flow / UI / Schema / Plan in `docs/`  
- [ ] Paste these docs at the start of every agent session: *“Source of truth; do not contradict.”*

**Done when:** All six docs exist and match the repo.

---

## Phase 1 — Project foundation (done)

- [x] Next.js + TS + Tailwind + Prisma  
- [x] Local SQLite, ffmpeg-static, mock ASR  
- [x] Upload → process → editor → SRT/VTT/ASS  

**Done when:** Keyless demo works on `npm run dev`.

---

## Phase 2 — Production adapters (code done; wire in deploy)

- [x] Postgres switcher, S3 storage, BullMQ worker, Auth.js, quotas  
- [x] Dockerfile + docker-compose + DEPLOY.md  
- [ ] **Prod env:** `AUTH_ENABLED=true`, `AUTH_DEV_LOGIN=false`, secrets, R2/S3, Redis, Postgres  
- [ ] Smoke: `docker compose up --build` end-to-end  

**Done when:** Compose stack uploads a video and completes a Sarvam job.

---

## Phase 3 — Product features (done on feature branch)

- [x] Burned MP4 + Telugu TTFs  
- [x] Karaoke + spelling learner (auto on blur)  
- [x] Sarvam codemix + romanize runs + energy chunking  
- [x] Short frames + Center Pop default + position drag  
- [x] Style Analyzer + My Styles + Prism Pro approx  
- [x] True aspect ratio preview/export  

**Done when:** Vertical Telugu clip → Center Pop → Export MP4 looks shippable.

---

## Phase 4 — Production hardening (in progress)

| Task | Owner | Status |
|------|-------|--------|
| Structured logging for job failures | App | Done (`src/lib/log.ts` + processor) |
| Rate limits / abuse on `/api/upload` | App | Done (`src/lib/rate-limit.ts`) |
| Optional Sentry (`SENTRY_DSN`) | App | Done (`src/lib/sentry.ts`) |
| `STRICT_PROD_AUTH` boot gate | App | Done |
| Merge feature branch → `main` / release | Git | Pending (you) |
| Managed Postgres + Redis + R2 | Host | Pending |
| Domain + HTTPS + Google OAuth redirect | Host | Pending |
| Postgres backups + bucket lifecycle | Ops | Pending |
| Cost alerts on Sarvam / Anthropic | Ops | Pending |
| Staging smoke with auth on | Host+QA | Pending |

Full checklist: [07-phase4-checklist.md](./07-phase4-checklist.md)

**Done when:** Staging URL processes a real Telugu video with auth on.

---

## Phase 5 — Quality & edge cases (in progress)

| Task | Status |
|------|--------|
| Failed job clear error + retry | Done |
| Quota exhaustion UX | Done |
| Spelling learner insert/delete hardening | Done |
| Manual matrix + font parity checklist | Docs: [08-phase5-checklist.md](./08-phase5-checklist.md) — **you run** |

**Done when:** Checklist signed off; failure rate &lt; 5% on sample set.

---

## Phase 6 — Soft launch (in progress)

| Task | Status |
|------|--------|
| Landing + README soft-launch copy | Done |
| Seeded spelling builtins (GitHub, Fable, YouTube, …) | Done |
| Soft-launch invite + tracker | [09-phase6-launch.md](./09-phase6-launch.md) |
| Prod env template | [env.production.example.md](./env.production.example.md) |
| Production deploy + LIVE_URL | **Pending (you)** |
| Invite 5–10 creators | **Pending (you)** |

**Done when:** External user completes upload → edit → Export MP4 without help.

---

## Phase 7 — Post-launch (v1.1+)

| Track | Status |
|-------|--------|
| 7.1 Better timings (`TIMING_PROVIDER=openai`) | Done — see [10-phase7-roadmap.md](./10-phase7-roadmap.md) |
| 7.2 Razorpay billing + plan quotas | Deferred — free demo; Razorpay later |
| 7.3 Multi-language Indic packs | Not started |
| 7.4 Batch jobs | Not started |

Full roadmap: [10-phase7-roadmap.md](./10-phase7-roadmap.md).
---

## Agent rules while implementing

1. Read docs `01`–`06` first; prefer extending adapters.  
2. One `SubtitleStyle` drives preview + ASS + burn.  
3. Never commit secrets.  
4. Don’t remove auto-learn or Center Pop defaults without PRD change.  
5. Prefer small PRs: one phase / one feature.  

---

## Definition of “finished” (production v1)

- [ ] Authenticated users can upload Telugu video  
- [ ] Captions appear romanized, ~2-word frames, Center Pop  
- [ ] Edits teach spelling for future jobs  
- [ ] Position adjustable (Top/Middle/Bottom/drag)  
- [ ] Burned MP4 downloads successfully on portrait footage  
- [ ] Postgres + object storage + worker in prod  
- [ ] Quotas enforced; no open email-only login  

When all boxes above are checked, **v1 is shipped**.
