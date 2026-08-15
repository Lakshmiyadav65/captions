/** Fetch a remote file and save it under `filename` (Chrome-safe for CDN URLs). */
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

  try {
    const res = await fetch(abs);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size) {
        const objectUrl = URL.createObjectURL(blob);
        try {
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = safeName;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          a.remove();
          await new Promise((r) => setTimeout(r, 1500));
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
        return;
      }
    }
  } catch {
    /* fall through to direct link */
  }

  const a = document.createElement("a");
  a.href = abs;
  a.download = safeName;
  a.target = "_blank";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
