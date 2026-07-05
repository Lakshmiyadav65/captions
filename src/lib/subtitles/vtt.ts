import type { Segment } from "@/lib/transcription/types";

function pad(n: number, w = 2): string {
  return String(Math.floor(n)).padStart(w, "0");
}

/** 00:00:01.234 */
export function vttTime(sec: number): string {
  const t = Math.max(0, sec);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${pad(t / 3600)}:${pad((t / 60) % 60)}:${pad(t % 60)}.${pad(ms, 3)}`;
}

export function toVTT(segments: Segment[]): string {
  return (
    "WEBVTT\n\n" +
    segments
      .map(
        (s, i) =>
          `${i + 1}\n${vttTime(s.start)} --> ${vttTime(s.end)}\n${s.text}`,
      )
      .join("\n\n") +
    "\n"
  );
}
