# 04 — UI/UX Design Brief

**Product:** Telugu Captions  
**Goal:** Creator tool that feels like a focused editor — dark, dense, export-first — not a marketing site.

---

## Aesthetic

- **Dark-mode first** (near-black canvas, subtle borders)  
- Minimal chrome; product name secondary to the **video + captions**  
- Inspiration: CapCut editor density + Linear’s quiet controls — **not** purple SaaS gradients  
- Kinetic captions default: **Center Pop** (bold white, mid-frame, pop-in) inspired by modern Reels

---

## Color palette

| Token | Value | Use |
|-------|-------|-----|
| Background | `#0a0a0a` / `neutral-950` | Page |
| Surface | `neutral-900` | Panels, cards |
| Border | `white/10` | Hairlines |
| Text primary | `neutral-100` / white | Body |
| Text muted | `neutral-400`–`500` | Labels |
| Accent / CTA | `sky-500`–`600` | Primary actions, active states |
| Success | `emerald-500`–`600` | Export MP4, saved |
| Warning | `amber-500` | Mock / caution banners |
| Danger | `red-400`–`500` | Failures, delete |

Avoid: purple-on-white themes, heavy multi-layer shadows, emoji-heavy UI.

---

## Typography

| Role | Choice |
|------|--------|
| UI chrome | System / Tailwind defaults OK for chrome |
| Caption preview | Bundled Telugu fonts — default **NTR** (Center Pop) |
| Transcript | Noto Sans Telugu |
| Mono | Timecodes in `font-mono` |

Caption size is **% of video height** (`fontSizePct`), not fixed px.

---

## Component style

- Corners: `rounded-lg` / `rounded-xl` (≈ 8–12px)  
- Panels: thin ring `ring-1 ring-white/10`, soft shadow only on video stage  
- Buttons: solid for primary (emerald Export), quiet neutral for secondary  
- Segmented controls for Top/Middle/Bottom, effects, karaoke  
- Preset picker: **visual cards** + category tabs (not only text chips)

---

## Caption visual language (product default)

| Property | Center Pop (default) |
|----------|----------------------|
| Color | White `#FFFFFF` |
| Outline | Off (soft bloom shadow) |
| Position | ~52% from top (middle) |
| Animation | Pop-in |
| Density | ~2 words per frame |
| Placement UX | Drag on preview + Top/Middle/Bottom |

Optional effects: glow, pill/bar boxes, Prism Pro (frosted shimmer — preview-rich; ASS approximates).

---

## Layout

- Editor: `1fr + 360px` sidebar on large screens; stack on mobile  
- Preview sized to **real video aspect ratio** (portrait/square/landscape)  
- Sticky style panel on desktop  

---

## Motion

- Caption entrance: fade / pop (CSS; ASS `\fad` / scale `\t`)  
- Progress bars: CSS width transition  
- Karaoke: per-word color fill when timings exist  
- Prefer 2–3 intentional motions; no decorative noise  

---

## Dark / light

- **Dark only** for v1 production UI  
- Light mode: out of scope  

---

## Mobile

- Fully usable stacked layout  
- Upload + edit + export must work on phone browser  
- Drag-to-position: touch (`touch-action: none` on caption)  

---

## Accessibility

- Sufficient contrast on sky/emerald CTAs against dark  
- Form labels on timing inputs  
- Don’t rely on color alone for status (text + color)  
- Video must remain controllable when caption is draggable (pointer events only on caption)

---

## Reference apps / looks

- CapCut / Instagram Reels kinetic captions (Center Pop source vibe)  
- [Captions.ai](https://captions.ai/) Prism Pro — optional premium effect, not default  
- Linear / Vercel — chrome restraint  

---

## Do not

- Lock preview to 16:9 when video is 9:16  
- Overwhelm first viewport with dashboards/stats  
- Put Listener dictionary panel back in the sidebar (learning is automatic)  
