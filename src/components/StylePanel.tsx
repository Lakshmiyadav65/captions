"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ENGLISH_FONTS, TELUGU_FONTS, fontStack, type CaptionFont } from "@/lib/fonts";
import type {
  SubtitleStyle,
  TextAlign,
  TextCase,
  TextEffect,
} from "@/lib/subtitles/style";
import { effectiveBoxMode, effectiveTextCase } from "@/lib/subtitles/style";
import {
  matchingPresetId,
  PRESETS,
  PRESETS_V3,
  type StylePreset,
} from "./presets";

// The live styling controls. Every change calls onChange with a partial patch; the
// parent merges it into the single SubtitleStyle that drives both preview and export.

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-[var(--ed-muted,#a39d93)]">
        <span>{label}</span>
        {value !== undefined && <span className="tabular-nums text-neutral-500">{value}</span>}
      </div>
      {children}
    </label>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const span = max - min || 1;
  const pct = Math.min(100, Math.max(0, ((value - min) / span) * 100));
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="ed-range w-full disabled:opacity-40"
      style={{ "--ed-range": `${pct}%` } as CSSProperties}
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-[var(--ed-line,#e8e4de)] bg-transparent"
      />
      <span className="font-mono text-xs text-[var(--ed-muted,#a39d93)]">{value.toUpperCase()}</span>
    </div>
  );
}

/** Quick neon / social accent picks for Hook keywords and karaoke fill. */
const KEYWORD_SWATCHES: { label: string; hex: string }[] = [
  { label: "Magenta", hex: "#FF4EC8" },
  { label: "Lime", hex: "#C8FF00" },
  { label: "Orange", hex: "#FF8A00" },
  { label: "Cyan", hex: "#00E5FF" },
  { label: "Yellow", hex: "#FFE100" },
  { label: "White", hex: "#FFFFFF" },
  { label: "Red", hex: "#FF3B5C" },
  { label: "Violet", hex: "#A855F7" },
];

function KeywordColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="space-y-2">
      <ColorInput value={value} onChange={onChange} />
      <div className="flex flex-wrap gap-1.5">
        {KEYWORD_SWATCHES.map((s) => {
          const active = value.toUpperCase() === s.hex.toUpperCase();
          return (
            <button
              key={s.hex}
              type="button"
              title={s.label}
              aria-label={s.label}
              onClick={() => onChange(s.hex)}
              className={`h-7 w-7 rounded-md border transition ${
                active
                  ? "border-[var(--ed-accent,#e4571b)] ring-2 ring-[var(--ed-accent,#e4571b)]/40"
                  : "border-[var(--ed-line,#e8e4de)] hover:border-[var(--ed-soft,#736e66)]"
              }`}
              style={{ background: s.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-[var(--ed-chip,#fbfaf8)] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.value
              ? "bg-[var(--ed-accent,#e4571b)] text-white"
              : "text-[var(--ed-soft,#736e66)] hover:text-[var(--ed-ink,#1b1a18)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const FEATURED_ENGLISH_IDS = [
  "geist",
  "instrument-serif",
  "anton",
  "manrope",
  "open-sans",
  "oswald",
] as const;

const FEATURED_TELUGU_IDS = [
  "noto",
  "mandali",
  "mallanna",
  "ntr",
  "gidugu",
  "suranna",
] as const;

function splitFonts(all: CaptionFont[], featuredIds: readonly string[]) {
  const featured = featuredIds
    .map((id) => all.find((f) => f.id === id))
    .filter((f): f is CaptionFont => Boolean(f));
  const rest = all.filter((f) => !featuredIds.includes(f.id));
  return { featured, rest };
}

function FontGrid({
  fonts,
  featuredIds,
  sample,
  value,
  onChange,
}: {
  fonts: CaptionFont[];
  featuredIds: readonly string[];
  sample: string;
  value: string;
  onChange: (family: string) => void;
}) {
  const { featured, rest } = splitFonts(fonts, featuredIds);
  const restSelected = rest.some((f) => f.family === value);
  return (
    <div className="ed-font-grid">
      <div className="ed-font-featured">
        {featured.map((f) => {
          const active = value === f.family;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.family)}
              title={f.note}
              className={`ed-font-tile${active ? " is-active" : ""}`}
            >
              <span className="ed-font-sample" style={{ fontFamily: fontStack(f.family) }}>
                {sample}
              </span>
              <span className="ed-font-label">{f.label}</span>
            </button>
          );
        })}
      </div>
      {rest.length > 0 && (
        <label className="ed-font-more">
          <select
            value={restSelected ? value : ""}
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value);
            }}
            aria-label="More typefaces"
          >
            <option value="">More</option>
            {rest.map((f) => (
              <option key={f.id} value={f.family}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="ed-font-more-v" aria-hidden>
            v
          </span>
        </label>
      )}
    </div>
  );
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mini thumbnail that approximates the preset look for the picker grid. */
function PresetCard({
  preset,
  active,
  onSelect,
}: {
  preset: StylePreset;
  active: boolean;
  onSelect: () => void;
}) {
  const s = preset.style;
  const box = effectiveBoxMode(s);
  const showBox = box !== "none" && s.backgroundOpacity > 0;
  const effect = s.textEffect ?? "none";
  const prism = effect === "prism";
  const ember = effect === "ember";
  const negative = effect === "negative";
  const glow = s.glowStrength > 0
    ? `0 0 ${s.glowStrength * 2}px ${s.glowColor}, 0 0 ${s.glowStrength * 4}px ${s.glowColor}`
    : "none";
  const shadow = s.shadow ? "0 1px 3px rgba(0,0,0,0.85)" : "none";

  const sampleStyle: CSSProperties =
    prism
      ? {
          fontFamily: fontStack(s.fontFamily),
          fontWeight: s.fontWeight,
          backgroundImage:
            "linear-gradient(115deg,#fff,#d2e6ff,#fff,#ffc8f0,#c8fff0,#fff)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
        }
      : ember
        ? {
            fontFamily: fontStack(s.fontFamily),
            fontWeight: s.fontWeight,
            backgroundImage: "linear-gradient(90deg,#ffb347,#ff6a00,#ff3b30,#ff1e56)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 6px rgba(255,59,48,0.45))",
            textTransform: "uppercase",
            letterSpacing: `${s.letterSpacingEm}em`,
          }
        : {
            fontFamily: fontStack(s.fontFamily),
            fontWeight: s.fontWeight,
            color: negative ? "#FFFFFF" : s.karaoke ? s.highlightColor : s.color,
            mixBlendMode: negative ? "difference" : undefined,
            textTransform:
              effectiveTextCase(s) === "upper"
                ? "uppercase"
                : effectiveTextCase(s) === "lower"
                  ? "lowercase"
                  : "none",
            letterSpacing: `${s.letterSpacingEm}em`,
            WebkitTextStroke:
              s.outlineWidth > 0 && !showBox
                ? `${Math.min(s.outlineWidth * 0.25, 1.2)}px ${s.outlineColor}`
                : undefined,
            paintOrder: "stroke fill",
            textShadow: [glow !== "none" ? glow : null, shadow !== "none" ? shadow : null]
              .filter(Boolean)
              .join(", ") || "none",
            background:
              showBox && box !== "bar"
                ? hexToRgba(s.backgroundColor, s.backgroundOpacity)
                : "transparent",
            borderRadius: box === "pill" ? 999 : box === "inline" ? 3 : 0,
          };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`ed-preset-card${active ? " is-active" : ""}`}
    >
      <div className="ed-preset-preview">
        {box === "bar" && showBox && (
          <div
            className="ed-preset-bar"
            style={{
              top: s.positionYPct < 40 ? "18%" : "62%",
              background: hexToRgba(s.backgroundColor, s.backgroundOpacity),
            }}
          />
        )}
        <span
          className={`ed-preset-sample${showBox && box !== "bar" ? " has-box" : ""}`}
          style={sampleStyle}
        >
          {preset.sample ?? "Aa"}
        </span>
      </div>
      <span className="ed-preset-name">{preset.name}</span>
    </button>
  );
}

export function StylePanel({
  style,
  onChange,
  onApplyPreset,
  wordsPerFrame,
  onWordsPerFrameChange,
  panel = "all",
}: {
  style: SubtitleStyle;
  onChange: (patch: Partial<SubtitleStyle>) => void;
  onApplyPreset: (s: SubtitleStyle) => void;
  /** How many words appear in each on-screen caption frame (1–6). */
  wordsPerFrame?: number;
  onWordsPerFrameChange?: (n: number) => void;
  /** Editor right-rail tabs: preset | text | effect | all (legacy full panel). */
  panel?: "preset" | "text" | "effect" | "all";
}) {
  const [tier, setTier] = useState<"basic" | "advanced">("advanced");
  const activeId = matchingPresetId(style);

  const filteredV2 = tier === "basic" ? PRESETS : [];
  const filteredV3 = tier === "advanced" ? PRESETS_V3 : [];

  const applyPreset = (p: StylePreset) => {
    onApplyPreset({ ...p.style });
    if (onWordsPerFrameChange) {
      if (typeof p.wordsPerFrame === "number") {
        onWordsPerFrameChange(p.wordsPerFrame);
      } else if (p.generation === "3.0") {
        onWordsPerFrameChange(3);
      }
    }
  };

  const showPreset = panel === "all" || panel === "preset";
  const showText = panel === "all" || panel === "text";
  const showEffect = panel === "all" || panel === "effect";

  return (
    <div className="ed-style-panel">
      {showPreset && wordsPerFrame !== undefined && onWordsPerFrameChange && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-neutral-500">
            Words per frame
          </h3>
          <Segmented
            value={wordsPerFrame}
            onChange={onWordsPerFrameChange}
            options={[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({
              label: String(n),
              value: n,
            }))}
          />
        </section>
      )}

      {showPreset && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-neutral-500">
            Font size
          </h3>
          <Slider
            min={1}
            max={10}
            step={0.1}
            value={Math.min(style.fontSizePct, 10)}
            onChange={(v) => onChange({ fontSizePct: v })}
          />
        </section>
      )}

      {showPreset && (
      <section className="space-y-2">
        <div className="ed-tier" role="group" aria-label="Preset set">
          {(
            [
              { id: "basic" as const, label: "Basic" },
              { id: "advanced" as const, label: "Advanced" },
            ]
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={tier === c.id}
              onClick={() => setTier(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>
      )}

      {showPreset && filteredV3.length > 0 && (
        <section className="ed-preset-section">
          <div className="ed-preset-grid">
            {filteredV3.map((p: StylePreset) => (
              <PresetCard
                key={p.id}
                preset={p}
                active={activeId === p.id}
                onSelect={() => applyPreset(p)}
              />
            ))}
          </div>
        </section>
      )}

      {showPreset && filteredV2.length > 0 && (
        <section className="ed-preset-section">
          <div className="ed-preset-grid">
            {filteredV2.map((p: StylePreset) => (
              <PresetCard
                key={p.id}
                preset={p}
                active={activeId === p.id}
                onSelect={() => applyPreset(p)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Text case — top of Text tab */}
      {showText && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-neutral-500">
            Text case
          </h3>
          <Segmented
            value={style.textCase ?? (style.uppercase ? "upper" : "none")}
            onChange={(v) =>
              onChange({
                textCase: v as TextCase,
                uppercase: v === "upper",
              })
            }
            options={[
              { label: "As typed", value: "none" },
              { label: "Sentence", value: "sentence" },
              { label: "Title", value: "title" },
              { label: "lower", value: "lower" },
              { label: "UPPER", value: "upper" },
            ]}
          />
        </section>
      )}

      {showText && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-neutral-500">
            Weight
          </h3>
          <Segmented
            value={style.fontWeight}
            onChange={(v) => onChange({ fontWeight: v })}
            options={[
              { label: "Regular", value: 400 },
              { label: "Medium", value: 500 },
              { label: "Bold", value: 700 },
            ]}
          />
        </section>
      )}

      {/* Font */}
      {showText && (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500">
          Font
        </h3>
        <Field label="English typefaces">
          <FontGrid
            fonts={ENGLISH_FONTS}
            featuredIds={FEATURED_ENGLISH_IDS}
            sample="Aa Bb"
            value={style.fontFamily}
            onChange={(family) => onChange({ fontFamily: family })}
          />
        </Field>
        <Field label="Telugu typefaces">
          <FontGrid
            fonts={TELUGU_FONTS}
            featuredIds={FEATURED_TELUGU_IDS}
            sample="తెలుగు"
            value={style.fontFamily}
            onChange={(family) => onChange({ fontFamily: family })}
          />
        </Field>

        <Field
          label="Font size"
          value={Math.min(style.fontSizePct, 10).toFixed(1)}
        >
          <Slider
            min={1}
            max={10}
            step={0.1}
            value={Math.min(style.fontSizePct, 10)}
            onChange={(v) => onChange({ fontSizePct: v })}
          />
        </Field>
      </section>
      )}

      {/* Colors */}
      {showText && (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500">
          Colors
        </h3>
        <Field label="Text color">
          <KeywordColorPicker
            value={style.color}
            onChange={(hex) => onChange({ color: hex })}
          />
        </Field>
        <Field label="Keyword accent">
          <KeywordColorPicker
            value={style.highlightColor}
            onChange={(hex) => {
              // Hook uses accent for the big word + matching glow.
              if ((style.animation ?? "none") === "hook" || (style.glowStrength ?? 0) > 0) {
                onChange({ highlightColor: hex, glowColor: hex });
              } else {
                onChange({ highlightColor: hex });
              }
            }}
          />
        </Field>
        <Field label="Outline color">
          <ColorInput value={style.outlineColor} onChange={(v) => onChange({ outlineColor: v })} />
        </Field>
        <Field label="Outline width" value={`${style.outlineWidth.toFixed(1)} px`}>
          <Slider min={0} max={10} step={0.5} value={style.outlineWidth} onChange={(v) => onChange({ outlineWidth: v })} />
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">Drop shadow</span>
          <Segmented
            value={style.shadow ? "on" : "off"}
            onChange={(v) => onChange({ shadow: v === "on" })}
            options={[
              { label: "On", value: "on" },
              { label: "Off", value: "off" },
            ]}
          />
        </div>
      </section>
      )}

      {/* Effects */}
      {showEffect && (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500">
          Effects
        </h3>
        <Field label="Text effect">
          <Segmented
            value={(style.textEffect ?? "none") as TextEffect}
            onChange={(v) => onChange({ textEffect: v as TextEffect })}
            options={[
              { label: "Flat", value: "none" },
              { label: "Prism", value: "prism" },
              { label: "Negative", value: "negative" },
              { label: "Ember", value: "ember" },
            ]}
          />
        </Field>
        <Field label="Glow strength" value={`${(style.glowStrength ?? 0).toFixed(0)}`}>
          <Slider
            min={0}
            max={8}
            step={1}
            value={style.glowStrength ?? 0}
            onChange={(v) => onChange({ glowStrength: v })}
          />
        </Field>
        {(style.glowStrength ?? 0) > 0 && (
          <Field label="Glow color">
            <ColorInput
              value={style.glowColor ?? style.color}
              onChange={(v) => onChange({ glowColor: v })}
            />
          </Field>
        )}
      </section>
      )}

      {/* Layout */}
      {showText && (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500">
          Layout
        </h3>
        <Field label="Alignment">
          <Segmented
            value={style.align}
            onChange={(v) => onChange({ align: v as TextAlign })}
            options={[
              { label: "Left", value: "left" },
              { label: "Center", value: "center" },
              { label: "Right", value: "right" },
            ]}
          />
        </Field>
        <Field label="Max width" value={`${Math.round(style.maxWidthPct)}%`}>
          <Slider min={40} max={100} step={1} value={style.maxWidthPct} onChange={(v) => onChange({ maxWidthPct: v })} />
        </Field>
        <Field label="Line height" value={style.lineHeight.toFixed(2)}>
          <Slider min={0.9} max={2} step={0.05} value={style.lineHeight} onChange={(v) => onChange({ lineHeight: v })} />
        </Field>
        <Field label="Letter spacing" value={`${style.letterSpacingEm.toFixed(2)} em`}>
          <Slider min={-0.05} max={0.3} step={0.01} value={style.letterSpacingEm} onChange={(v) => onChange({ letterSpacingEm: v })} />
        </Field>
      </section>
      )}
    </div>
  );
}
