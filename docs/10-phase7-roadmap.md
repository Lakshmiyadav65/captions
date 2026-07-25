# Phase 7 — Post-launch roadmap (v1.1+)

Priority order from the implementation plan. This doc tracks status.

| # | Track | Status |
|---|-------|--------|
| 7.1 | Better timings (Sarvam text + Whisper words) | **Shipped** (`TIMING_PROVIDER=openai`) |
| 7.2 | Stripe billing + plan quotas | Not started |
| 7.3 | Multi-language Indic packs (hi / ta / kn) | Not started |
| 7.4 | Batch jobs | Not started |

---

## 7.1 Better timings

**Problem:** Sarvam code-mix text is good, but continuous speech often gets one timestamp span. Karaoke falls back to even word splits ([`src/lib/subtitles/karaoke.ts`](../src/lib/subtitles/karaoke.ts)).

**Solution:** Keep Sarvam (or primary ASR) for **text**. Optionally refine with OpenAI whisper-1 **word timestamps** and align onto display tokens.

```
TIMING_PROVIDER=none     # default — unchanged
TIMING_PROVIDER=openai   # requires OPENAI_API_KEY; ~Whisper $/min extra
```

| Piece | Location |
|-------|----------|
| Word-capable OpenAI provider | `src/lib/transcription/openai.ts` |
| Align helper | `src/lib/transcription/align-timings.ts` |
| Processor hook | `src/lib/processor.ts` |

**Done when:** With both keys + `TIMING_PROVIDER=openai`, karaoke fill tracks speech better on a short Telugu clip; Export MP4 `{\k}` tags use refined word times. With `none`, transcripts unchanged.

Research background: [session-sarvam-accuracy-timing.md](./session-sarvam-accuracy-timing.md).

---

## 7.2 Stripe billing + plan quotas

- Plans: free / creator / pro (minutes + concurrent jobs)
- Checkout + Customer Portal
- Map Stripe price → `QUOTA_*` overrides per user
- Webhook ledger (no raw card data in DB)

**Done when:** A paid user gets higher monthly minutes after successful checkout.

---

## 7.3 Multi-language Indic packs

- ASR language packs: `hi`, `ta`, `kn` (+ existing `te`)
- Romanize / script output per language
- UI language picker on upload
- Built-in spelling seeds per language

**Done when:** One non-Telugu Indic language completes upload → romanized captions → Export MP4.

---

## 7.4 Batch jobs

- Multi-file upload → N jobs
- Batch progress UI
- Shared style apply across batch

**Done when:** User drops 3 videos and exports all without re-opening the home page between each.

---

## Agent rules (Phase 7)

1. Prefer adapters over forking the pipeline.
2. Never replace Sarvam display text with Whisper text when refining timings.
3. One phase / one PR when possible.
