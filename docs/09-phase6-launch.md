# Phase 6 — Soft launch

Ship to a small set of Telugu creators, collect spelling/export feedback, then open wider.

**Done when:** An external creator finishes upload → edit → Export MP4 without you on a call.

---

## A. Before you invite anyone

- [ ] Merge feature branch → `main` (or tagged release)
- [ ] Host is live (Railway / Render / Fly) — see [DEPLOY.md](../DEPLOY.md) + [Phase 4](./07-phase4-checklist.md)
- [ ] `AUTH_ENABLED=true`, `AUTH_DEV_LOGIN=false`, `STRICT_PROD_AUTH=true`
- [ ] Google OAuth redirect matches your domain
- [ ] `ASR_PROVIDER=sarvam` + `SARVAM_API_KEY` + `SARVAM_MODE=codemix` + `OUTPUT_MODE=translit`
- [ ] Postgres + Redis + worker + S3/R2 (not SQLite / inline on the public URL)
- [ ] You personally ran one portrait Telugu clip end-to-end on the **live** URL
- [ ] Set `NEXT_PUBLIC_APP_URL=https://your-domain` (optional; for docs/README)

Paste the live URL here once it exists:

```
LIVE_URL=
```

---

## B. Soft-launch invite (copy / paste)

Subject: **Try Telugu Captions (invite)**

```
Hey — I built a small tool for Telugu Reels/Shorts:

1. Upload your video
2. Get romanized captions (English words stay English)
3. Fix any wrong word once — it remembers for next time
4. Export a burned MP4 ready to post

Link: <LIVE_URL>
Sign in with Google. Takes ~2–3 min for a 60s clip.

If something’s wrong, reply with:
- the word it misheard → what it should be
- portrait or landscape
- roughly how long the video was

Thanks!
```

Invite **5–10** creators first (tech / edtech / lifestyle). Prefer people who already post weekly.

---

## C. What to ask them for

| Feedback | Why |
|----------|-----|
| Spelling pairs (`getup` → `GitHub`) | Seed more `BUILTIN_SPELLING` |
| Export vs CapCut look | Style / font gaps |
| Time to “done” | Latency / chunking |
| Crash / failed job | Retry + logs |

Fold high-confidence pairs into `src/lib/spelling.ts` (`BUILTIN_SPELLING`) and redeploy.

---

## D. Soft-launch tracker

| # | Creator | Invited | Completed flow? | Notes |
|---|---------|---------|-----------------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

---

## E. Definition of done (Phase 6)

- [ ] Live URL in README + this doc  
- [ ] ≥3 creators completed upload → Export MP4 without help  
- [ ] At least one round of spelling builtins updated from their feedback  
- [ ] No open “blocker” bugs on the happy path  

Then Phase 7 (billing, better timings, more languages) when you’re ready.
