# 01 — PRD: Product Requirements Document

**Product:** Telugu Captions  
**Tagline:** Upload a Telugu video → timed romanized captions → style them → export a publish-ready MP4.  
**Status:** Soft launch prep (Phase 6). Feature MVP complete; public host URL pending.  
**Source of truth for agents:** Use this doc + `02`–`06` before changing product scope.

---

## Problem

Telugu creators (Reels / Shorts / YouTube) need captions that:

1. Understand **code-mixed Telugu + English** speech  
2. Show as **romanized Telugu** (easy to read on mobile)  
3. Look like modern kinetic captions (bold, centered, pop-in)  
4. Export as **burned-in MP4** without CapCut / Premiere  

Existing tools either fail on Telugu, write English phonetically wrong, or don’t burn styled captions well.

---

## Target user

**Primary:** Telugu tech / edtech / lifestyle creators (students, indie educators, niche YouTubers) who post vertical video weekly and need captions in under 10 minutes.

**Secondary:** Agencies editing Telugu UGC for clients.

Persona (2–3 sentences): *Ravi records talking-head Reels in Telugu with English tech words (“website”, “project”, “GitHub”). He wants romanized captions that keep English intact, short kinetic frames, and an MP4 he can post the same day — without learning CapCut karaoke presets.*

---

## Core value proposition

| Differentiator | Why it matters |
|----------------|----------------|
| Sarvam **codemix** ASR for Indian speech | English stays English; Telugu romanizes cleanly |
| **Auto-learn** corrections from edits | Same ASR mistake never repeats for that user |
| Kinetic **Center Pop** default + free placement | Matches modern short-form look out of the box |
| Style Analyzer + burned MP4 | Screenshot → style → export without leaving the app |
| Adapters (SQLite→Postgres, local→S3, inline→BullMQ) | Local zero-infra → production without rewrite |

---

## Features

### Must have (ship / keep working)

- [x] Video upload (streamed) with size/duration caps  
- [x] Audio extract + energy-aware chunking  
- [x] Sarvam / OpenAI / mock ASR providers  
- [x] Romanized Telugu output (`OUTPUT_MODE=translit`)  
- [x] Short frames (configurable `SUBTITLE_MAX_WORDS`, default 2)  
- [x] Live preview overlay (true video aspect ratio)  
- [x] Transcript editor (text + timings)  
- [x] Auto-learn word corrections on edit (blur)  
- [x] Built-in + per-user spelling rules on new jobs  
- [x] Style presets (Center Pop, Prism Pro, social/cinematic/karaoke/minimal/news)  
- [x] Caption position: Top / Middle / Bottom / drag / fine slider  
- [x] Karaoke highlight (when word timings exist)  
- [x] Export SRT / VTT / ASS + burned MP4  
- [x] Style Analyzer (screenshot → SubtitleStyle) + My Styles  
- [x] Quotas (minutes, concurrent jobs, analyses, generations)  
- [x] Auth adapters (dev user / Google OAuth)  
- [x] Docker compose (Postgres + Redis + app + worker)

### Nice to have (v1.1 / v2)

- [ ] Billing (Stripe) + paid tiers  
- [ ] Word-level timing via Whisper / alignment when Sarvam lacks it  
- [ ] Team workspaces / shared dictionaries  
- [ ] Multi-language beyond Telugu (hi, ta, kn)  
- [ ] Mobile-native app  
- [ ] Batch upload  
- [ ] Exact Captions.ai GPU glass shaders (beyond CSS Prism approx)

### Out of scope (this production launch)

- Full video editor (cuts, B-roll, music)  
- AI avatar / eye-contact / denoise (Captions.ai territory)  
- Guaranteeing pixel-perfect clone of third-party proprietary styles  
- Serverless-only hosting (ffmpeg + long jobs need containers)

---

## User stories

1. As a **creator**, I want to **upload a Telugu Reel and get romanized captions** so that I can post the same day.  
2. As a **creator**, I want to **fix one wrong word and have it remembered** so that future videos stay clean.  
3. As a **creator**, I want to **pick Center Pop or drag captions** so that text sits where my face isn’t covered.  
4. As a **creator**, I want to **export burned MP4** so that Instagram/TikTok show captions without SRT.  
5. As a **creator**, I want to **analyze a screenshot of a style I like** so that my brand look is reusable.  
6. As an **operator**, I want **Postgres + S3 + Redis + auth + quotas** so that the app can run in production safely.

---

## Success metrics

| Metric | Target (first 90 days post-launch) |
|--------|-------------------------------------|
| Time upload → ready captions | &lt; 3 min for a 60s vertical clip (p50) |
| Caption usefulness | ≥ 70% of jobs exported (SRT or MP4) without full rewrite |
| Correction learning | ≥ 30% of active users have ≥ 1 spelling rule within 2 weeks |
| Reliability | &lt; 5% job failure rate excluding user upload errors |
| Cost | ASR + vision cost &lt; $0.15 per average job at free-tier volume |

---

## Constraints

- Vertical-first (9:16), also landscape/square  
- Production must use **container host** (Railway / Render / Fly) — not Vercel alone  
- Secrets never committed; `.env` local only  
- Telugu fonts must ship as TTF for libass burned export  

---

## Related docs

- [02 TRD](./02-trd.md)  
- [03 App Flow](./03-app-flow.md)  
- [04 UI/UX](./04-ui-ux-brief.md)  
- [05 Backend Schema](./05-backend-schema.md)  
- [06 Implementation Plan](./06-implementation-plan.md)  
