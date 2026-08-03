import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth-helpers";
import "./landing.css";

export const metadata: Metadata = {
  title: "Telugu Captions — create Telugu captions in seconds",
  description:
    "Upload a Short, generate accurate Telugu captions, customize the style, and export a post-ready video in minutes.",
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
