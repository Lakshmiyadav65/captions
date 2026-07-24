# Session notes: Sarvam accuracy, timing, preview ratio, short captions

Saved from a previous IDE chat (branch `phase3-burned-in-mp4`). Last related commit at save time: `0a14262`.

## Runtime / config (local `.env`, gitignored)

- `ASR_PROVIDER=sarvam` (live, not mock)
- `OUTPUT_MODE=translit`
- `SARVAM_API_KEY` set
- `SARVAM_MODE=codemix` (added during that session; required for good English)
- Defaults if unset: model `saaras:v3`, mode `transcribe` on `/speech-to-text`
- `SUBTITLE_MAX_WORDS` default `4` (0 = off)
- `ASR_CHUNK_SECONDS` / energy chunking (~12s target, max 28s Sarvam cap)

## Key Sarvam findings (empirically proven)

Sources: [Speech-to-Text overview](https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/speech-to-text/overview), [Saaras](https://docs.sarvam.ai/api-reference-docs/models/saaras), [Saarika](https://docs.sarvam.ai/api-reference-docs/models/saarika), [REST transcribe](https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe), [REST API guide](https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/speech-to-text/rest-api), [Batch API](https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/speech-to-text/batch-api), OpenAPI at `https://docs.sarvam.ai/openapi.json`.

### Models / modes

- **saaras:v3** (recommended): modes `transcribe`, `translate`, `verbatim`, `translit`, `codemix`
- **saarika:v2.5**: legacy native-script ASR
- Valid mode name is **`translit`**, not `transliterate` (latter HTTP 400)
- Telugu: `language_code=te-IN`

### Live A/B on real clip (`cmrkwxa350002thn800i8obuq`, first ~28s)

| Mode | Result |
|------|--------|
| `transcribe` | English written in Telugu script → local Sanscript mangled (`vebsait`, `vidiyo`) |
| `codemix` | English kept as English (`video`, `website`, `GitHub`); Telugu stays Telugu — **the fix** |
| `translit` | Works (HTTP 200); fully romanized by Sarvam |

### Timestamps — dead ends (tested)

| Route | Result |
|-------|--------|
| Sync + `with_timestamps=true` | 1 span for whole utterance (e.g. 0→21.99) |
| Batch job + `with_timestamps` + `with_diarization` | Same: 1 speaker-turn for continuous single narrator |
| ffmpeg `silencedetect` / energy VAD | 0 silences on loudness-normalized music-bed audio (mean ~−7 dB) |
| Local Whisper tiny | Junk / degenerate zero-width word timings |
| Local Whisper small | Near-empty without VAD; with VAD: full coverage but hallucinated Telugu words |
| Local Whisper medium+ | Blocked by ~1 GB free RAM on 15 GB machine |

**Conclusion:** Sarvam cannot give within-utterance / word-level timings for continuous single-speaker + music. Karaoke per-word from Sarvam alone is not achievable. Batch API flow works (init → upload → start → poll → download) but does not fix timing for this content.

### Remaining timing options (not shipped)

1. **OpenAI whisper-1** for word timestamps + Sarvam codemix for text (needs `OPENAI_API_KEY`; ~$0.006/min)
2. Energy-aware chunking — **shipped** (bounds drift to ~12s chunks; snaps cuts to lowest RMS)

## Bugs fixed & commits

| Commit | What |
|--------|------|
| `6e18907` | `romanizeTelugu`: only Telugu-script runs; preserve ā→aa, ī→ee, ū→oo; don't mangle English (`chollege` bug) |
| `ff6eb7e` | Energy-aware audio chunking (`src/lib/audio-chunk.ts`) wired into processor |
| `275a46e` | Portrait overflow: PreviewStage real aspect; ASS PlayRes from real dims; `getVideoSize`; export route |
| `49c6718` | Job.width/height stored at process time; preview uses `initialAspect`; existing jobs backfilled |
| `464ceaf` | Split captions to ≤4 words (`splitSegmentsToMaxWords`, `SUBTITLE_MAX_WORDS`); transcripts backfilled |
| `0a14262` | `BUILTIN_SPELLING` for recurring ASR mishears; applied before per-user dictionary; backfilled |

## Proven end-to-end caption example

Before: `So i vidiyo chuse varaku vebsait ayite ayipotuntadi`  
After: `So ee video choose varaku website ayite ayipotuntadi`

Energy chunks on that ~22s clip: cuts around `11.355s` (low-energy pause).

Residual ASR mishears (not code bugs): e.g. GitHub→getup, ML→AML — handled via dictionary / re-upload under codemix.

## Files touched (core)

- `.env` — `SARVAM_MODE=codemix` (local only)
- `src/lib/transliterate.ts` — run-based romanizer
- `src/lib/audio-chunk.ts` — energy-aware chunking
- `src/lib/config.ts` — chunk + `SUBTITLE_MAX_WORDS`
- `src/lib/processor.ts` — chunking, dims, short frames, builtin spelling
- `src/lib/transcription/util.ts` — `splitSegmentsToMaxWords`
- `src/lib/spelling.ts` — `BUILTIN_SPELLING`
- `src/components/PreviewStage.tsx`, `Editor.tsx`
- `src/app/jobs/[id]/page.tsx`
- `src/lib/subtitles/ass.ts`, `src/lib/ffmpeg.ts` (`getVideoSize`)
- `src/app/api/export/[id]/route.ts`
- `prisma/schema.prisma` — `Job.width`, `Job.height`

## How accuracy improves from here

1. **Dictionary panel** — add content-specific fixes once (e.g. `Phaabul`→`Fable`, `getup`→`GitHub`); auto-applies to future jobs
2. **Re-upload old pre-codemix jobs** — old `transcribe` phonetic Telugu (`vebsait`, `prajekt`) need reprocess
3. Fold safe universal mishears into `BUILTIN_SPELLING` as more videos surface them
4. Word-level karaoke: wait for OpenAI (or other) key + whisper-1 timing pass

## Ops notes from that session

- App uses bundled `ffmpeg-static` (system ffmpeg may be missing)
- Dev: `npm run dev` → http://localhost:3000
- Old jobs cache transcripts in DB — re-open does not reprocess; new upload or re-run needed for pipeline changes
- Local Prisma: `npx prisma db push` used for width/height; production Postgres needs same schema sync
- Scratch/test artifacts that may exist: `A:\captions-e2e`, `A:\whisper-test`, `A:\whisper-cache` — safe to delete
- C: disk was critically full at one point; keep free space for pagefile / builds

## Listener (learn-from-edit)

On **Save edits**, the editor diffs each line against the ASR baseline (`diffWordCorrections`), upserts word rules into `SpellingRule`, applies them across the current transcript, and uses them on every future job (via processor). Right panel renamed **Listener**. Manual add still works.

Accuracy probe of `A:\Captions App Testing` (first 30s): report at `A:\Captions App Testing\_accuracy_report.md`.
