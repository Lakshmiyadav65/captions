"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ENGLISH_FONTS, TELUGU_FONTS, fontStack } from "@/lib/fonts";
import type {
  BoxMode,
  CaptionAnimation,
  EmphasisMode,
  SubtitleStyle,
  TextAlign,
  TextCase,
  TextEffect,
} from "@/lib/subtitles/style";
import { effectiveBoxMode, effectiveTextCase } from "@/lib/subtitles/style";
import {
  matchingPresetId,
  PRESET_CATEGORIES,
  PRESETS,
  PRESETS_V3,
  type PresetCategory,
  type StylePreset,
} from "./presets";

// The live styling controls. Every change calls onChange with a partial patch; the
// parent merges it into the single SubtitleStyle that drives both preview and export.

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-neutral-400">
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
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-sky-500 disabled:opacity-40"
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
        className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
      />
      <span className="font-mono text-xs text-neutral-400">{value.toUpperCase()}</span>
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
                  ? "border-sky-400 ring-2 ring-sky-400/50"
                  : "border-white/15 hover:border-white/40"
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
    <div className="inline-flex flex-wrap rounded-lg bg-neutral-800 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.value
              ? "bg-sky-600 text-white"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {o.label}
        </button>
      ))}
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
      className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${
        active
          ? "border-sky-500 ring-1 ring-sky-500/60"
          : "border-white/10 hover:border-white/25"
      }`}
    >
      <div
        className="relative flex h-14 items-center justify-center overflow-hidden px-2"
        style={{
          background: prism
            ? "linear-gradient(160deg, #64748b 0%, #334155 45%, #1e293b 100%)"
            : negative
              ? "linear-gradient(160deg, #e2e8f0 0%, #64748b 55%, #0f172a 100%)"
              : "radial-gradient(120% 120% at 50% 0%, #334155 0%, #0f172a 75%)",
        }}
      >
        {box === "bar" && showBox && (
          <div
            className="absolute inset-x-0"
            style={{
              top: s.positionYPct < 40 ? "18%" : "62%",
              height: "38%",
              background: hexToRgba(s.backgroundColor, s.backgroundOpacity),
            }}
          />
        )}
        <span
          className={`relative z-[1] max-w-full truncate px-1.5 text-[11px] font-semibold leading-none ${
            showBox && box !== "bar" ? "inline-flex items-center pt-[5px] pb-[3px]" : "py-0.5 leading-tight"
          }`}
          style={sampleStyle}
        >
          {preset.sample ?? "Aa"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/5 bg-neutral-900 px-2 py-1.5">
        <div className="truncate text-[11px] font-medium text-neutral-200">{preset.name}</div>
        <div className="shrink-0 truncate text-[10px] text-neutral-500">
          {preset.tag ?? preset.category}
        </div>
      </div>
    </button>
  );
}

export function StylePanel({
  style,
  onChange,
  onApplyPreset,
  wordsPerFrame,
  onWordsPerFrameChange,
}: {
  style: SubtitleStyle;
  onChange: (patch: Partial<SubtitleStyle>) => void;
  onApplyPreset: (s: SubtitleStyle) => void;
  /** How many words appear in each on-screen caption frame (1–6). */
  wordsPerFrame?: number;
  onWordsPerFrameChange?: (n: number) => void;
}) {
  const [category, setCategory] = useState<PresetCategory | "all">("all");
  const activeId = matchingPresetId(style);

  const filteredV2 = useMemo(
    () =>
      category === "all" || category === "premium"
        ? category === "premium"
          ? []
          : PRESETS
        : PRESETS.filter((p) => p.category === category),
    [category],
  );

  const filteredV3 = useMemo(
    () =>
      category === "all" || category === "premium"
        ? PRESETS_V3
        : PRESETS_V3.filter((p) => p.category === category),
    [category],
  );

  const boxMode = effectiveBoxMode(style);

  const applyPreset = (p: StylePreset) => {
    onApplyPreset({ ...p.style });
    if (p.generation === "3.0" && onWordsPerFrameChange) {
      onWordsPerFrameChange(3);
    }
  };

  return (
    <div className="space-y-6">
      {/* Caption density — how many words share each on-screen frame */}
      {wordsPerFrame !== undefined && onWordsPerFrameChange && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Words per frame
          </h3>
          <Field label="Caption density" value={`${wordsPerFrame} word${wordsPerFrame === 1 ? "" : "s"}`}>
            <Segmented
              value={wordsPerFrame}
              onChange={onWordsPerFrameChange}
              options={[1, 2, 3, 4, 5, 6].map((n) => ({
                label: String(n),
                value: n,
              }))}
            />
          </Field>
          <p className="text-[10px] leading-relaxed text-neutral-600">
            Fewer words feel punchier; more words show longer phrases at once.
            Changing this rebuilds your caption lines.
          </p>
        </section>
      )}

      {/* Preset filters */}
      <section className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {PRESET_CATEGORIES.filter((c) => c.id !== "premium").map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                category === c.id
                  ? "bg-sky-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCategory("premium")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              category === "premium"
                ? "bg-amber-600 text-white"
                : "bg-neutral-800 text-amber-500/90 hover:text-amber-300"
            }`}
          >
            3.0
          </button>
        </div>
      </section>

      {/* Presets — Styles 2.0 */}
      {filteredV2.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Styles 2.0
          </h3>
          <div className="grid grid-cols-2 gap-2">
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

      {/* Presets — Styles 3.0 Premium */}
      {filteredV3.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">
            Styles 3.0 · Premium
          </h3>
          <p className="text-[10px] leading-relaxed text-neutral-600">
            Elegant mixed-type captions — blue focus word, italic serif supports, and
            automatic layout shifts as speech advances.
          </p>
          <div className="grid grid-cols-2 gap-2">
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

      {/* Caption position — prominent so users can place top / middle / bottom / anywhere */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Caption position
        </h3>
        <Field label="Place on frame">
          <Segmented
            value={
              style.positionYPct <= 28
                ? "top"
                : style.positionYPct >= 72
                  ? "bottom"
                  : style.positionYPct >= 40 && style.positionYPct <= 60
                    ? "middle"
                    : "custom"
            }
            onChange={(v) => {
              if (v === "top") onChange({ positionYPct: 14 });
              else if (v === "middle") onChange({ positionYPct: 50 });
              else if (v === "bottom") onChange({ positionYPct: 86 });
            }}
            options={[
              { label: "Top", value: "top" },
              { label: "Middle", value: "middle" },
              { label: "Bottom", value: "bottom" },
            ]}
          />
        </Field>
        <Field label="Fine-tune" value={`${Math.round(style.positionYPct)}% from top`}>
          <Slider
            min={5}
            max={95}
            step={1}
            value={style.positionYPct}
            onChange={(v) => onChange({ positionYPct: v })}
          />
        </Field>
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Or drag the caption on the video preview to place it anywhere.
        </p>
      </section>

      {/* Font */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Font
        </h3>
        <Field label="English typefaces">
          <div className="grid grid-cols-2 gap-2">
            {ENGLISH_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ fontFamily: f.family })}
                title={f.note}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  style.fontFamily === f.family
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-white/10 bg-neutral-800 hover:border-white/25"
                }`}
              >
                <div
                  className="text-lg leading-tight text-white"
                  style={{ fontFamily: fontStack(f.family) }}
                >
                  Aa Bb
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-400">{f.label}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Telugu typefaces">
          <div className="grid grid-cols-2 gap-2">
            {TELUGU_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ fontFamily: f.family })}
                title={f.note}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  style.fontFamily === f.family
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-white/10 bg-neutral-800 hover:border-white/25"
                }`}
              >
                <div
                  className="text-lg leading-tight text-white"
                  style={{ fontFamily: fontStack(f.family) }}
                >
                  తెలుగు
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-400">{f.label}</div>
              </button>
            ))}
          </div>
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
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Size 1–10. Best looking captions are usually around 3–4.
        </p>

        <Field label="Weight">
          <Segmented
            value={style.fontWeight}
            onChange={(v) => onChange({ fontWeight: v })}
            options={[
              { label: "Regular", value: 400 },
              { label: "Medium", value: 500 },
              { label: "Bold", value: 700 },
            ]}
          />
        </Field>
      </section>

      {/* Colors */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Hook / Atelier accent, karaoke fill, and auto emphasis. Pick a
          swatch or any custom color.
        </p>
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

      {/* Effects */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Prism / Negative / Ember are richest in the live preview. Burned MP4 uses a close ASS
          approximation.
        </p>
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
        <Field label="Box style">
          <Segmented
            value={boxMode}
            onChange={(v) => {
              const mode = v as BoxMode;
              onChange({
                boxMode: mode,
                backgroundOpacity:
                  mode === "none"
                    ? 0
                    : style.backgroundOpacity > 0
                      ? style.backgroundOpacity
                      : 0.75,
              });
            }}
            options={[
              { label: "None", value: "none" },
              { label: "Inline", value: "inline" },
              { label: "Pill", value: "pill" },
              { label: "Bar", value: "bar" },
            ]}
          />
        </Field>
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Pill corners are preview-only; burned MP4 uses a rectangular ASS box.
        </p>
        {boxMode === "pill" && (
          <Field label="Pill radius" value={`${(style.boxRadiusPct ?? 1.2).toFixed(1)}%`}>
            <Slider
              min={0.5}
              max={4}
              step={0.1}
              value={style.boxRadiusPct ?? 1.2}
              onChange={(v) => onChange({ boxRadiusPct: v })}
            />
          </Field>
        )}
        <Field label="Entrance">
          <Segmented
            value={(style.animation ?? "none") as CaptionAnimation}
            onChange={(v) => onChange({ animation: v as CaptionAnimation })}
            options={[
              { label: "None", value: "none" },
              { label: "Fade", value: "fade" },
              { label: "Pop", value: "pop" },
              { label: "Kinetic", value: "kinetic" },
              { label: "Scatter", value: "scatter" },
              { label: "Hook", value: "hook" },
              { label: "Flash", value: "flash" },
              { label: "Editorial", value: "editorial" },
              { label: "Atelier (3.0)", value: "atelier" },
              { label: "Typewriter", value: "typewriter" },
            ]}
          />
        </Field>
      </section>

      {/* Karaoke + keyword emphasis */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Word-by-word (karaoke)
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">
            Highlight each word as spoken
          </span>
          <Segmented
            value={style.karaoke ? "on" : "off"}
            onChange={(v) =>
              onChange(
                v === "on"
                  ? { karaoke: true, emphasisMode: "off" }
                  : { karaoke: false },
              )
            }
            options={[
              { label: "On", value: "on" },
              { label: "Off", value: "off" },
            ]}
          />
        </div>
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Spoken words fill with the accent color; upcoming words stay dim. Turns off keyword
          emphasis so the progressive fill is easy to see.
        </p>
        <Field label="Keyword emphasis">
          <Segmented
            value={(style.emphasisMode ?? "off") as EmphasisMode}
            onChange={(v) => onChange({ emphasisMode: v as EmphasisMode })}
            options={[
              { label: "Off", value: "off" },
              { label: "Auto", value: "auto" },
            ]}
          />
        </Field>
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Auto paints keywords in the accent color (Tharun Speaks look). While karaoke is on,
          spoken-word fill takes priority over Auto. Change the color under Colors → Keyword
          accent.
        </p>
        {(style.karaoke ||
          (style.emphasisMode ?? "off") === "auto" ||
          (style.animation ?? "none") === "hook") && (
          <Field label="Accent / highlight color">
            <KeywordColorPicker
              value={style.highlightColor}
              onChange={(hex) => {
                if ((style.animation ?? "none") === "hook" || (style.glowStrength ?? 0) > 0) {
                  onChange({ highlightColor: hex, glowColor: hex });
                } else {
                  onChange({ highlightColor: hex });
                }
              }}
            />
          </Field>
        )}
      </section>

      {/* Background box color/opacity */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Background box
        </h3>
        <Field label="Box color">
          <ColorInput value={style.backgroundColor} onChange={(v) => onChange({ backgroundColor: v })} />
        </Field>
        <Field label="Box opacity" value={`${Math.round(style.backgroundOpacity * 100)}%`}>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={style.backgroundOpacity}
            disabled={boxMode === "none"}
            onChange={(v) => onChange({ backgroundOpacity: v })}
          />
        </Field>
      </section>

      {/* Layout */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
        <Field label="Text case">
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
        </Field>
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Sentence = first letter capital, rest lower. Title = Each Word Capitalized.
        </p>
      </section>
    </div>
  );
}
