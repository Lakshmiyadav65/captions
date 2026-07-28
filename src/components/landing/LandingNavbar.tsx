"use client";

import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import type { LandingUser } from "@/components/landing/types";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

export type { LandingUser };

const SIGN_IN_HREF = `/signin?next=${encodeURIComponent("/?start=1")}`;

function displayName(user: LandingUser): string {
  const raw = (user.name ?? "").trim() || (user.email ?? "").split("@")[0] || "Account";
  return raw.split(/\s+/)[0] ?? raw;
}

function initials(user: LandingUser): string {
  const name = (user.name ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
  }
  return ((user.email ?? "?").slice(0, 1)).toUpperCase();
}

export function LandingNavbar({
  canStart,
  user,
  uploadHref = "#upload",
}: {
  canStart: boolean;
  user: LandingUser | null;
  /** Home uses in-page #upload; other pages link back to home upload. */
  uploadHref?: string;
}) {
  return (
    <header className="navbar">
      <div className="container nav-container">
        <Link href="/" className="logo">
          <img src="/logo.png" alt="Caplio" className="nav-logo-img" />
        </Link>

        <nav className="nav-links">
          <a href={uploadHref === "#upload" ? "#upload" : "/#upload"}>Product</a>
          <a href="/#features">Features</a>
          <Link href="/billing">Pricing</Link>
          <Link href="/style-analyzer">Analyzer</Link>
          <Link href="/style-request">24h Style</Link>
        </nav>

        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <div className="nav-account">
              <a href={uploadHref} className="btn-primary">
                Upload
              </a>
              <div className="nav-user" title={user.email ?? undefined}>
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="nav-user-avatar" />
                ) : (
                  <span className="nav-user-avatar nav-user-initials" aria-hidden>
                    {initials(user)}
                  </span>
                )}
                <span className="nav-user-name">{displayName(user)}</span>
              </div>
              <form action={signOutAction}>
                <button type="submit" className="nav-signout">
                  Sign out
                </button>
              </form>
            </div>
          ) : canStart ? (
            <a href={uploadHref} className="btn-primary">
              Start free
            </a>
          ) : (
            <Link href={SIGN_IN_HREF} className="btn-primary">
              Start free
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
