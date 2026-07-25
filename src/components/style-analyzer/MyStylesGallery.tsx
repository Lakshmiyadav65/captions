"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SavedStyleDTO } from "@/lib/vision/types";
import { StaticPreview } from "./StaticPreview";
import { DEFAULT_SAMPLE } from "./samples";

// "My Styles" gallery: each saved style previews via the SAME SubtitleOverlay renderer, so a
// card thumbnail matches the burned MP4. "Use in editor" stashes the style for the editor to
// pick up; "Delete" removes it (optimistic).

export function MyStylesGallery({ initial }: { initial: SavedStyleDTO[] }) {
  const router = useRouter();
  const [styles, setStyles] = useState(initial);

  const use = (s: SavedStyleDTO) => {
    sessionStorage.setItem("pendingStyle", JSON.stringify(s.subtitleStyle));
    router.push("/");
  };

  const remove = async (id: string) => {
    setStyles((prev) => prev.filter((s) => s.id !== id)); // optimistic
    await fetch(`/api/styles/${id}`, { method: "DELETE" }).catch(() => {});
  };

  if (styles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-neutral-900/60 px-6 py-16 text-center">
        <p className="text-neutral-300">No saved styles yet.</p>
        <a
          href="/style-analyzer"
          className="mt-3 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Analyze a caption style
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {styles.map((s) => (
        <div key={s.id} className="space-y-3 rounded-xl border border-white/10 bg-neutral-900/60 p-3">
          <StaticPreview text={DEFAULT_SAMPLE} style={s.subtitleStyle} />
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-neutral-100" title={s.name}>
              {s.name}
            </span>
            <span className="shrink-0 text-xs text-neutral-500">
              {Math.round(s.confidence * 100)}%
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => use(s)}
              className="flex-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
            >
              Use in editor
            </button>
            <button
              type="button"
              onClick={() => remove(s.id)}
              className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 hover:bg-red-500/20 hover:text-red-300"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
