"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeResponse } from "@/lib/vision/types";
import { ScreenshotDropzone } from "./ScreenshotDropzone";
import { ProfilePanel } from "./ProfilePanel";
import { StaticPreview } from "./StaticPreview";
import { SAMPLES, DEFAULT_SAMPLE } from "./samples";

// Client spine for /style-analyzer: upload -> analyze -> preview the extracted style on an
// original sample caption -> save to "My Styles" (or send it to the editor). Works fully on
// the keyless mock; the same flow lights up with real analysis once live vision is wired.

type Phase = "idle" | "analyzing" | "error" | "refusal" | "done";

export function StyleAnalyzer({ initial }: { initial?: AnalyzeResponse }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initial ? "done" : "idle");
  const [result, setResult] = useState<AnalyzeResponse | null>(initial ?? null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [caption, setCaption] = useState(DEFAULT_SAMPLE);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    setCaption(DEFAULT_SAMPLE);
    setName("");
    setSaveState("idle");
  };

  const onResult = (r: AnalyzeResponse) => {
    setResult(r);
    setName(r.profile.vibe.slice(0, 40));
    setPhase("done");
  };

  const save = async () => {
    if (!result) return;
    setSaveState("saving");
    const res = await fetch("/api/styles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "Untitled style", analysisId: result.analysisId }),
    });
    setSaveState(res.ok ? "saved" : "idle");
  };

  const useInEditor = () => {
    if (!result) return;
    sessionStorage.setItem("pendingStyle", JSON.stringify(result.subtitleStyle));
    router.push("/");
  };

  // --- Not yet analyzed: dropzone + status ---
  if (phase !== "done" || !result) {
    return (
      <div className="space-y-4">
        <ScreenshotDropzone
          busy={phase === "analyzing"}
          onStart={() => {
            setErrorMsg(null);
            setPhase("analyzing");
          }}
          onResult={onResult}
          onError={(msg, refusal) => {
            setErrorMsg(msg);
            setPhase(refusal ? "refusal" : "error");
          }}
        />

        {phase === "analyzing" && (
          <ul className="grid grid-cols-2 gap-2 text-sm text-neutral-400 sm:grid-cols-3">
            {["Font", "Colors", "Layout", "Effects", "Style"].map((s) => (
              <li key={s} className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                Reading {s.toLowerCase()}…
              </li>
            ))}
          </ul>
        )}

        {(phase === "error" || phase === "refusal") && errorMsg && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              phase === "refusal"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            <p className="font-medium">
              {phase === "refusal" ? "Couldn't analyze this image" : "Analysis failed"}
            </p>
            <p className="mt-1 opacity-90">{errorMsg}</p>
          </div>
        )}
      </div>
    );
  }

  // --- Analyzed: results ---
  const { profile, subtitleStyle, imageUrl, match } = result;

  return (
    <div className="space-y-6">
      {match && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This looks similar to your saved{" "}
          <a href="/styles" className="font-semibold underline underline-offset-2">
            {match.name}
          </a>{" "}
          style ({Math.round(match.similarity * 100)}% match).
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: source + live preview */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <figure className="space-y-1.5">
              <figcaption className="text-xs text-neutral-500">Your screenshot</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Uploaded caption screenshot"
                className="max-h-64 w-full rounded-xl object-contain ring-1 ring-white/10"
              />
            </figure>
            <figure className="space-y-1.5">
              <figcaption className="text-xs text-neutral-500">Recreated style (new caption)</figcaption>
              <StaticPreview text={caption} style={subtitleStyle} />
            </figure>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-neutral-900 p-4">
            <label className="block text-xs font-medium text-neutral-400">
              Preview caption
            </label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
              placeholder="Type a Telugu caption to preview…"
            />
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCaption(s)}
                  className="rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-600">
              AI caption generation from a prompt is coming next — for now, type or pick a line
              to see it in this style.
            </p>
          </div>
        </div>

        {/* Right: analysis + actions */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          <ProfilePanel profile={profile} />

          <div className="space-y-2 rounded-xl border border-white/10 bg-neutral-900 p-4">
            <label className="block text-xs font-medium text-neutral-400">Save this style</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
              placeholder="Style name"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saveState === "saving" || saveState === "saved"}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save to My Styles"}
              </button>
              <button
                type="button"
                onClick={useInEditor}
                className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
              >
                Use in editor
              </button>
            </div>
            {saveState === "saved" && (
              <a href="/styles" className="block text-xs text-sky-400 hover:text-sky-300">
                View My Styles →
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            ← Analyze another screenshot
          </button>
        </aside>
      </div>
    </div>
  );
}
