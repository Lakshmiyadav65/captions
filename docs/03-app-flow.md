# 03 — App Flow: Navigation & User Journeys

**Product:** Telugu Captions  
**Nav pattern:** Minimal top links (Home / Style Analyzer / My Styles / Sign in). No heavy app shell.

---

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Upload dropzone + recent context; start a job |
| `/jobs/[id]` | Editor: preview, transcript, styles, export |
| `/style-analyzer` | Upload caption screenshot → extract style |
| `/styles` | My Styles gallery (saved styles) |
| `/signin` | Auth (Google / dev login when enabled) |
| `/api/**` | Upload, jobs SSE, transcript, export, spelling, styles, analyze |

---

## First screen

**New visitor (auth off):** `/` — dark dropzone, “upload video”, link to Style Analyzer.  
**Auth on, logged out:** redirect `/signin` → after login → `/`.

---

## Auth flow

```
/signin
  → Google OAuth (prod) or email-only (AUTH_DEV_LOGIN=true, never in prod)
  → Session cookie (Auth.js)
  → Redirect /
```

Protected: upload, jobs, export, spelling, style APIs when `AUTH_ENABLED=true`.

---

## Core journey 1 — Caption a video

```
1. /  → drop or pick video
2. POST /api/upload → Job created (queued)
3. Redirect /jobs/[id]
4. SSE /api/jobs/[id]/stream → extracting → transcribing → done
5. Load transcript; preview with Center Pop default
6. Optional: edit wrong words → blur → auto-learn spelling + auto-save
7. Optional: Style presets / drag caption position / Top·Middle·Bottom
8. Export MP4 (POST /api/export/[id]) or ↓ SRT / VTT / ASS
9. Download publish-ready file
```

---

## Core journey 2 — Steal a style from a reference

```
1. /style-analyzer → drop screenshot of caption look
2. Analyze (Anthropic or mock) → StyleProfile + SubtitleStyle
3. Save to My Styles OR “Use in editor”
4. sessionStorage pendingStyle → open /jobs/[id] applies style
```

---

## Core journey 3 — Learner loop (accuracy)

```
1. On job done, user edits “getup” → “GitHub” and leaves the field
2. Client diffs words → POST /api/spelling { rules }
3. Apply across current transcript + persist transcript
4. Next job: processor loads SpellingRule + BUILTIN_SPELLING before save
```

---

## Navigation structure

- Home link on job / analyzer pages  
- User menu (sign out / identity) when auth on  
- Editor: left = preview + transcript; right sticky = Style panel  
- No bottom tabs (desktop-first; responsive stack on mobile)

---

## Empty / loading / error states

| State | UX |
|-------|-----|
| Processing | Progress bar + status labels (Queued / Extracting / Transcribing) |
| Failed | Red panel with `error` message |
| Mock ASR | Amber banner: sample transcript, add API key |
| No styles yet | Empty My Styles gallery CTA → analyzer |
| No transcript yet | Wait for SSE `done` |
| Export busy | “Rendering MP4…” disabled button |

---

## Redirects

| Event | Destination |
|-------|-------------|
| Upload success | `/jobs/[id]` |
| Sign-in success | `/` (or callbackUrl) |
| Sign-out | `/` or `/signin` |
| Unauthorized API | `401` JSON |

---

## Modals / overlays

- Video native controls (not custom modal)  
- Style Analyzer results inline (not separate modal-heavy flow)  
- Learned-correction toast on editor (auto-dismiss)

---

## Edge cases agents must preserve

- Re-opening an old job does **not** re-run ASR (transcript cached)  
- Portrait jobs use stored `width`/`height` for preview aspect  
- Dragging captions updates `positionYPct` live; ASS burn uses same style  
- Ghost “Drag to position” when no active caption line  
