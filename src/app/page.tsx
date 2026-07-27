import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth-helpers";
import "./landing.css";

export const metadata: Metadata = {
  title: "Telugu Captions AI — Generate Viral Telugu Subtitles for Reels & Shorts",
  description:
    "AI that captions Telugu videos like a native creator would. Romanized Telugu by default, native script switch, and burned-in MP4 export ready to post.",
};

export default async function Home() {
  const user = await currentUser();
  // Only treat as signed-in for UI when auth is actually enabled (local demo always
  // has a synthetic user, but we should not show their name in the nav).
  const signedIn = config.authEnabled && Boolean(user);
  // When auth is off, local demo mode — Start free can go straight to upload.
  const canStart = !config.authEnabled || signedIn;

  return (
    <LandingPage
      canStart={canStart}
      authEnabled={config.authEnabled}
      user={
        signedIn && user
          ? { name: user.name, email: user.email, image: user.image }
          : null
      }
    />
  );
}
