import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import "./landing.css";

export const metadata: Metadata = {
  title: "Telugu Captions AI — Generate Viral Telugu Subtitles for Reels & Shorts",
  description:
    "AI that captions Telugu videos like a native creator would. Romanized Telugu by default, native script switch, and burned-in MP4 export ready to post.",
};

export default function Home() {
  return <LandingPage />;
}
