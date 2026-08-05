# Phase 7 — Post-launch roadmap (v1.1+)

Priority order from the implementation plan. This doc tracks status.

| # | Track | Status |
|---|-------|--------|
| 7.1 | Better timings (Sarvam text + Whisper words) | **Shipped** (`TIMING_PROVIDER=openai`) |
| 7.2 | Razorpay billing + plan quotas | Deferred (free demo now) |
| 7.3 | Multi-language Indic packs (hi / ta / kn) | Not started |
| 7.4 | Batch jobs | Not started |

---

## 7.1 Better timings

**Problem:** Sarvam code-mix text is good, but continuous speech often gets one timestamp span. Karaoke falls back to even word splits ([`src/lib/subtitles/karaoke.ts`](../src/lib/subtitles/karaoke.ts)).

**Solution:** Keep Sarvam (or primary ASR) for **text**. Optionally refine with OpenAI whisper-1 **word timestamps** and align onto display tokens.

```
TIMING_PROVIDER=openai   # default — Whisper word times; needs OPENAI_API_KEY
TIMING_PROVIDER=none     # skip refine (Sarvam proportional timings only)
ASR_CHUNK_SECONDS=12
ASR_CHUNK_TAIL_SECONDS=6 # shorter energy chunks near the end
```

| Piece | Location |
|-------|----------|
| Word-capable OpenAI provider | `src/lib/transcription/openai.ts` |
| Align helper (global remap) | `src/lib/transcription/align-timings.ts` |
| Processor hook | `src/lib/processor.ts` |
| Tail energy chunking | `src/lib/audio-chunk.ts` |

**Done when:** With both keys + `TIMING_PROVIDER=openai`, karaoke fill tracks speech better on a short Telugu clip; Export MP4 `{\k}` tags use refined word times. With `none`, transcripts unchanged. Final energy chunks stay ≤ ~tail target so end-of-video drift is bounded.

Research background: [session-sarvam-accuracy-timing.md](./session-sarvam-accuracy-timing.md).

---

## 7.2 Razorpay billing + plan quotas

**Decision (soft launch):** No paid checkout yet. Demo users stay on **Free** with env quotas (`QUOTA_MONTHLY_MINUTES`, `QUOTA_MAX_ACTIVE_JOBS`). Payment provider when we charge: **Razorpay** (not Stripe).

When plans are decided:
- Keep Free / Creator / Pro (or rename) minute + concurrency limits in `src/lib/plans.ts`
- Razorpay Checkout / Subscriptions + webhook → set `User.plan`
- Map Razorpay plan/price ids → quota overrides
- Billing UI returns only after keys + plan matrix are final

Legacy Stripe routes under `src/app/api/billing/*` and `src/lib/stripe.ts` are unused for this product path — replace when implementing Razorpay.

**Done when:** A paid user gets higher monthly minutes after successful Razorpay subscription.

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
