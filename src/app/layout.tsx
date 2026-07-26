import "./globals.css";

// Self-hosted English caption fonts (preview). Matching TTFs in assets/fonts burn into MP4.
import "@fontsource/instrument-serif/400.css";
import "@fontsource/arimo/400.css";
import "@fontsource/arimo/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/700.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/700.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/700.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/700.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/700.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/anton/400.css";

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
  title: "Telugu Captions AI — Generate Viral Telugu Subtitles for Reels & Shorts",
  description:
    "AI that captions Telugu videos like a native creator would. Upload a Telugu video, get timed romanized captions, style them live, and export a publish-ready burned MP4.",
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
