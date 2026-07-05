"use client";

import type { ReactNode } from "react";
import { TELUGU_FONTS, fontStack } from "@/lib/fonts";
import type { SubtitleStyle, TextAlign } from "@/lib/subtitles/style";
import { PRESETS } from "./presets";

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
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-sky-500"
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
    <div className="inline-flex rounded-lg bg-neutral-800 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
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

export function StylePanel({
  style,
  onChange,
  onApplyPreset,
}: {
  style: SubtitleStyle;
  onChange: (patch: Partial<SubtitleStyle>) => void;
  onApplyPreset: (s: SubtitleStyle) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Presets */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Style presets
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p.style)}
              className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-sky-500/50 hover:bg-neutral-700"
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      {/* Font */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Font
        </h3>
        <Field label="Typeface">
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

        <Field label="Font size" value={`${style.fontSizePct.toFixed(1)}%`}>
          <Slider min={2} max={12} step={0.1} value={style.fontSizePct} onChange={(v) => onChange({ fontSizePct: v })} />
        </Field>

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
          <ColorInput value={style.color} onChange={(v) => onChange({ color: v })} />
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

      {/* Background box */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Background box
        </h3>
        <Field label="Box color">
          <ColorInput value={style.backgroundColor} onChange={(v) => onChange({ backgroundColor: v })} />
        </Field>
        <Field label="Box opacity" value={`${Math.round(style.backgroundOpacity * 100)}%`}>
          <Slider min={0} max={1} step={0.05} value={style.backgroundOpacity} onChange={(v) => onChange({ backgroundOpacity: v })} />
        </Field>
      </section>

      {/* Layout */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Position &amp; layout
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
        <Field label="Vertical position" value={`${Math.round(style.positionYPct)}%`}>
          <Slider min={5} max={95} step={1} value={style.positionYPct} onChange={(v) => onChange({ positionYPct: v })} />
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
    </div>
  );
}
