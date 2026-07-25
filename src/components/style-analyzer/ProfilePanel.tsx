"use client";

import { TELUGU_FONTS } from "@/lib/fonts";
import type { StyleProfile } from "@/lib/vision/types";

// The "AI Analysis" readout: the detected design language (typography / colors / layout /
// effects / vibe) with a confidence pill. Mirrors the spec's ✓ Font / Colors / Layout /
// Effects / Style checklist.

function Swatch({ label, color }: { label: string; color: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-5 w-5 shrink-0 rounded border border-white/20"
        style={{
          background: color ?? "transparent",
          backgroundImage: color
            ? undefined
            : "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px",
        }}
      />
      <span className="text-neutral-400">{label}</span>
      <span className="ml-auto font-mono text-xs text-neutral-300">{color ?? "none"}</span>
    </div>
  );
}

function Group({ title, ok, children }: { title: string; ok: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900/60 p-3">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        <span className={ok ? "text-emerald-400" : "text-neutral-600"}>✓</span>
        {title}
      </h4>
      <div className="space-y-1.5 text-sm">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-400">{k}</span>
      <span className="text-neutral-200">{v}</span>
    </div>
  );
}

export function ProfilePanel({ profile }: { profile: StyleProfile }) {
  const fontLabel =
    TELUGU_FONTS.find((f) => f.id === profile.fontMatch.fontId)?.label ??
    profile.fontMatch.fontId;
  const conf = Math.round(profile.confidence * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">AI analysis</h3>
        <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300">
          {conf}% confidence
        </span>
      </div>

      <Group title="Font" ok>
        <Row k="Typeface" v={fontLabel} />
        <Row k="Category" v={profile.font.category} />
        <Row k="Weight" v={profile.font.weight} />
        <Row k="Size" v={profile.typography.sizeBucket.toUpperCase()} />
        {profile.typography.uppercase && <Row k="Case" v="UPPERCASE" />}
      </Group>

      <Group title="Colors" ok>
        <Swatch label="Text" color={profile.colors.text} />
        <Swatch label="Outline" color={profile.colors.outline} />
        <Swatch label="Background" color={profile.colors.background} />
        {profile.effects.karaoke && <Swatch label="Highlight" color={profile.colors.highlight} />}
      </Group>

      <Group title="Layout" ok>
        <Row k="Alignment" v={profile.layout.align} />
        <Row k="Position" v={profile.layout.positionBucket} />
        <Row k="Width" v={profile.layout.maxWidthBucket} />
      </Group>

      <Group title="Effects" ok>
        <Row k="Outline" v={profile.outline.present ? profile.outline.weight : "none"} />
        <Row k="Shadow" v={profile.effects.shadow ? "on" : "off"} />
        <Row k="Background box" v={profile.colors.backgroundOpacity} />
        <Row k="Word-by-word" v={profile.effects.karaoke ? "on" : "off"} />
      </Group>

      <Group title="Style" ok>
        <p className="text-neutral-300">{profile.vibe}</p>
      </Group>
    </div>
  );
}
