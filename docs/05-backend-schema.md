# 05 — Backend Schema: Data Model & Auth

**ORM:** Prisma  
**Local:** SQLite · **Prod:** PostgreSQL (same models)  
**Canonical file:** [`prisma/schema.prisma`](../prisma/schema.prisma)

---

## ER overview

```
User 1──* Job 1──1 Transcript
User 1──* SpellingRule
User 1──* StyleAnalysis
User 1──* SavedStyle
User 1──* GenerationLog
User 1──* Account / Session   (Auth.js)
StylePreset                 (global, optional DB presets)
```

---

## Tables

### `Job`

| Column | Type | Notes |
|--------|------|-------|
| id | cuid | PK |
| status | string | `queued` \| `extracting` \| `transcribing` \| `done` \| `failed` |
| progress | int | 0–100 |
| provider | string | `mock` \| `sarvam` \| `openai` |
| language | string? | e.g. `te` |
| error | string? | failure message |
| originalName | string? | upload filename |
| videoKey | string? | storage key |
| durationSec | float? | |
| width / height | int? | pixel size for aspect + ASS |
| userId | string? | FK → User, SetNull on delete |
| createdAt / updatedAt | datetime | |

Indexes: `userId`.

### `Transcript`

| Column | Type | Notes |
|--------|------|-------|
| id | cuid | PK |
| jobId | string | unique FK → Job cascade |
| language | string? | |
| segments | string | JSON `Segment[]` `{ start, end, text, words? }` |

### `SpellingRule`

| Column | Type | Notes |
|--------|------|-------|
| id | cuid | PK |
| userId | string | FK cascade |
| from | string | ASR mistake (stored lowercase) |
| to | string | correction |
| @@unique([userId, from]) | | |

Applied in processor **after** `BUILTIN_SPELLING`, before persist. Auto-upserted on transcript edit.

### `StylePreset` (DB)

Optional named presets in DB (code also ships `PRESETS` in `presets.ts`).  
`style` = JSON `SubtitleStyle`.

### `StyleAnalysis`

Ledger + result for Style Analyzer (also monthly analyze quota).

| Column | Notes |
|--------|-------|
| imageKey | screenshot in storage |
| provider | `mock` \| `anthropic` |
| profile | JSON StyleProfile |
| subtitleStyle | JSON SubtitleStyle |
| ocrText | optional |
| confidence | float |

Index: `[userId, createdAt]`.

### `SavedStyle`

User’s “My Styles”.

| Column | Notes |
|--------|-------|
| name | display |
| profile | similarity key |
| subtitleStyle | render-ready |
| sourceImageKey | optional |
| confidence | float |

### `GenerationLog`

One row per AI caption generation (quota ledger). Index `[userId, createdAt]`.

### Auth.js: `User`, `Account`, `Session`, `VerificationToken`

Standard NextAuth Prisma adapter shapes.

---

## Relationships

- `Job.userId` → `User.id` (many-to-one, nullable for legacy)  
- `Transcript.jobId` → `Job.id` (1:1, cascade)  
- Spelling / styles / analyses / generations → User (cascade)

---

## Auth & access

| Rule | Behavior |
|------|----------|
| Auth off | All jobs owned by `local@dev` user |
| Auth on | APIs require session; users see/edit own jobs |
| RLS | App-enforced via `userId` filters (not Postgres RLS yet) |
| Roles | Single role `user` for v1; no admin console |

---

## Quotas (application layer)

| Cap | Env |
|-----|-----|
| Monthly ASR minutes | `QUOTA_MONTHLY_MINUTES` |
| Concurrent jobs | `QUOTA_MAX_ACTIVE_JOBS` |
| Monthly style analyses | `QUOTA_MONTHLY_ANALYSES` |
| Monthly generations | `QUOTA_MONTHLY_GENERATIONS` |
| Upload size / duration | `MAX_UPLOAD_MB`, `MAX_VIDEO_MINUTES` |

---

## File / media storage (not in DB)

```
uploads/<jobId>/source.mp4   (or .mov)
styles/…                     (analyzer screenshots)
```

DB stores **keys** only. Prod: S3/R2. Local: disk under `STORAGE` dir.

---

## Sensitive fields

| Data | Handling |
|------|----------|
| OAuth tokens | Auth.js Account table — never log |
| API keys | Env only |
| Video content | Object storage; presigned URLs for playback |
| Payments | Not stored (no Stripe in v1) |

---

## API surface (high level)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/upload` | Create job + store video |
| GET | `/api/jobs/[id]/stream` | SSE progress |
| GET/PUT | `/api/transcript/[id]` | Load / save segments |
| POST | `/api/export/[id]` | Burn MP4 |
| GET/POST/DELETE | `/api/spelling` | Learner rules |
| POST | `/api/analyze-style` | Vision analyze |
| GET/POST | `/api/styles` | Saved styles |
| POST | `/api/generate-caption` | AI caption text |
| * | `/api/auth/[...nextauth]` | Auth.js |
| GET | `/api/media/[...key]` | Local media proxy |

---

## Migration notes for production

1. Point `DATABASE_URL` to Postgres  
2. Run `prisma db push` or migrate on boot (Docker already does push)  
3. Do **not** change JSON segment shape without a versioned migration plan  
4. Backfill `width`/`height` for old jobs if missing (script already used once locally)  
