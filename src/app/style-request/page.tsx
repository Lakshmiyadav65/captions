import Link from "next/link";
import { redirect } from "next/navigation";
import { StyleRequestForm } from "@/components/style-request/StyleRequestForm";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/auth-helpers";
import "../landing.css";

export const metadata = {
  title: "Request a caption style — Caplio (Beta)",
  description:
    "Seen a Reel or Short caption style you love? Upload a reference and we’ll add it to your presets within about 24 hours.",
};

export default async function StyleRequestPage() {
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  if (config.authEnabled) {
    user = await currentUser();
    if (!user) {
      redirect(`/signin?next=${encodeURIComponent("/style-request")}`);
    }
  }

  const landingUser =
    config.authEnabled && user
      ? { name: user.name, email: user.email, image: user.image }
      : null;

  return (
    <div className="landing-page style-request-page">
      <div className="grain-texture" />
      <div className="ambient-background">
        <div className="glow glow-top-left" />
        <div className="glow glow-top-right" />
        <div className="glow glow-bottom" />
        <div className="glow glow-bottom-right" />
      </div>

      <LandingNavbar
        canStart={!config.authEnabled || Boolean(user)}
        user={landingUser}
        uploadHref="/#upload"
      />

      <main className="style-request-main">
        <div className="container">
          <div className="style-request-hero">
            <span className="style-request-badge">Beta · 24-hour style</span>
            <h1 className="style-request-title">Get the caption style you want</h1>
            <p className="style-request-subtitle">
              Creators spend hours copying looks from Instagram and YouTube. Tell us the style,
              upload a reference video (or screenshot), and we&apos;ll implement it for you —
              usually within 24 hours — so it shows up in your presets.
            </p>
          </div>

          <StyleRequestForm />
        </div>
      </main>
    </div>
  );
}
