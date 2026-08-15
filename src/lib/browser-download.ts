/** Fetch a file and save it under `filename`. Never navigates the tab. */
export async function downloadFromUrl(url: string, filename: string) {
  const raw = url.startsWith("http")
    ? url
    : new URL(url, window.location.origin).toString();

  let abs = raw;
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("download");
    abs = parsed.toString();
  } catch {
    /* keep raw */
  }

  const safeName = filename.toLowerCase().endsWith(".mp4") ? filename : `${filename}.mp4`;

  const res = await fetch(abs, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error("Could not download the video. Please try again.");
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("Could not download the video. Please try again.");
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = safeName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    await new Promise((r) => setTimeout(r, 400));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
