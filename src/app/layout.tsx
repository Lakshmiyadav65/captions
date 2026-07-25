import "./globals.css";

// Self-hosted Telugu subtitle fonts (bundled at build time — work offline, no Google CDN).
import "@fontsource/noto-sans-telugu/400.css";
import "@fontsource/noto-sans-telugu/500.css";
import "@fontsource/noto-sans-telugu/700.css";
import "@fontsource/mandali/400.css";
import "@fontsource/mallanna/400.css";
import "@fontsource/ntr/400.css";
import "@fontsource/gidugu/400.css";
import "@fontsource/suranna/400.css";
import "@fontsource/ramaraja/400.css";
import "@fontsource/dhurjati/400.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Telugu Captions — Romanized captions → burned MP4",
  description:
    "Upload a Telugu video, get timed romanized captions, style them live, and export a publish-ready burned MP4 (or SRT / VTT / ASS).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
