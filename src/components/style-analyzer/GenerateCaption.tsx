"use client";

import { useState } from "react";

// Generate an original Telugu caption from a prompt, in the extracted style's tone, and hand
// it up to the preview. Works on the keyless mock; real generation lights up with a key.

export function GenerateCaption({
  vibe,
  onGenerated,
}: {
  vibe: string;
  onGenerated: (text: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, vibe }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? "Generation failed");
      onGenerated(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-neutral-400">
        Generate a caption in this style
      </label>
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
          placeholder="e.g. a motivational line about starting today"
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy || !prompt.trim()}
          className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-60"
        >
          {busy ? "…" : "✨ Generate"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
