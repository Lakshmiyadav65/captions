# Telugu Captions — Product docs (vibe coding pack)

These six documents are the **source of truth** for shipping this product. Paste them (or link this folder) at the start of any AI coding session:

> *Use `docs/01`–`06` as the briefing. Do not invent a new stack, product scope, or data model that contradicts them.*

| # | Document | Purpose |
|---|----------|---------|
| 01 | [PRD](./01-prd.md) | What we’re building and for whom |
| 02 | [TRD](./02-trd.md) | Stack, adapters, APIs, env |
| 03 | [App Flow](./03-app-flow.md) | Pages, journeys, edge cases |
| 04 | [UI/UX Brief](./04-ui-ux-brief.md) | Look, feel, caption defaults |
| 05 | [Backend Schema](./05-backend-schema.md) | Tables, auth, quotas, APIs |
| 06 | [Implementation Plan](./06-implementation-plan.md) | Build order + prod checklist |
| 07 | [Phase 4 checklist](./07-phase4-checklist.md) | Staging/prod hardening |
| 08 | [Phase 5 checklist](./08-phase5-checklist.md) | QA matrix + font parity |
| 09 | [Phase 6 soft launch](./09-phase6-launch.md) | Invite pack + LIVE_URL |
| 10 | [Phase 7 roadmap](./10-phase7-roadmap.md) | Timings, Razorpay billing, languages, batch |
| 11 | [Magazine production](./11-production-magazine.md) | Audience Magazine launch checklist + runbooks |
| 12 | [Railway deploy](./12-railway-deploy.md) | Railway web + worker + Redis setup |
| 13 | [Oracle Always Free](./13-oracle-always-free.md) | $0 production VM + Compose |
| 14 | [Production Google OAuth](./14-production-google-oauth.md) | Audience sign-in on Vercel |
| — | [Production env example](./env.production.example.md) | Secrets / quotas for compose prod |
| — | [Oracle env example](./env.oracle.example.md) | Soft bring-up env for Oracle VM |

Also see:

- [README](../README.md) — quick start  
- [DEPLOY](../DEPLOY.md) — production hosting  
- [Session notes (ASR)](./session-sarvam-accuracy-timing.md) — Sarvam/timing research  

**Suggested order for humans:** PRD → TRD → Flow → UI → Schema → Plan.  
**Suggested order for agents shipping prod:** Plan Phase 4+ with Schema + TRD open.
