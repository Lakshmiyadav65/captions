# Phase 5 — Quality & edge cases

Manual QA + app hardening for shippable caption quality. App items below are in the repo; tick the matrix as you run real videos.

## A. App hardening (shipped)

| Item | Status |
|------|--------|
| Friendly job error copy + **Try again** (`POST /api/jobs/[id]/retry`) | Done |
| Quota / rate-limit UX (amber “Limit reached” on upload + generate) | Done |
| Quota API `code` fields (`quota_minutes`, `quota_active_jobs`, …) | Done |
| Spelling learner: resync baseline on insert/delete; skip rewrites | Done |

## B. Manual test matrix

Use real Telugu clips. Mark Pass / Fail / Notes.

| # | Case | Aspect | Length | Notes | Result |
|---|------|--------|--------|-------|--------|
| 1 | Clean speech, quiet room | Portrait | ~15s | Center Pop default | |
| 2 | Clean speech | Landscape | ~15s | Preview aspect correct | |
| 3 | Heavy code-mix (Telugu + English brands) | Either | ~30s | English words kept | |
| 4 | Music bed under voice | Portrait | ~30s | Chunking shouldn’t blank all | |
| 5 | Fast talking / dense | Portrait | ~1 min | ~2-word frames readable | |
| 6 | Longer clip | Either | ~5 min | Completes; quota minutes OK | |
| 7 | Edit spelling → new upload | — | short | Learned rule applies | |
| 8 | Add + delete caption lines | — | — | No junk spelling rules | |
| 9 | Failed job → Try again | — | — | Reprocesses without re-upload | |
| 10 | Hit monthly / concurrent quota | — | — | Amber limit copy | |
| 11 | Export burned MP4 | Portrait | short | Fonts match preview | |

**Pass bar:** ≥10/11 pass on staging (or local Sarvam). Target failure rate &lt; 5% across your sample set.

## C. Export font parity checklist

Preview font family must match ASS / burned MP4 (`assets/fonts/*.ttf`).

| UI family (`fonts.ts`) | TTF file | Preview OK | MP4 OK |
|------------------------|----------|------------|--------|
| Noto Sans Telugu | `NotoSansTelugu.ttf` | | |
| Mandali | `Mandali.ttf` | | |
| Mallanna | `Mallanna.ttf` | | |
| NTR | `NTR.ttf` | | |
| Gidugu | `Gidugu.ttf` | | |
| Suranna | `Suranna.ttf` | | |
| Ramaraja | `Ramaraja.ttf` | | |
| Dhurjati | `Dhurjati.ttf` | | |

For each: set style → Export MP4 → scrub 2–3 frames. Telugu glyphs must not be tofu; Latin/romanized look should match weight.

## D. Spelling learner regression

1. Load a done job.  
2. Fix one word on line 3 → blur → “Remembered …”.  
3. **Delete** line 2 → edit line 3 again → only real word fixes learned.  
4. **Insert** a blank line → type a new sentence → no rules from empty→full.  
5. Paste a wholly different sentence over a line → **no** bulk rules (&gt;5 skipped).

## E. Done criteria (Phase 5)

- [ ] Matrix §B filled (or explicitly deferred cases noted)  
- [ ] Font table §C spot-checked (at least Noto + NTR + one serif)  
- [ ] Failed-job retry works once end-to-end  
- [ ] Quota exhaustion shows amber copy, not a blank failure  

Then move to Phase 6 (Launch) in `06-implementation-plan.md`.
