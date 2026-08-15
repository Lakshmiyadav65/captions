"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import type { LandingUser } from "@/components/landing/types";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { DASHBOARD_PATH, dashboardSignInHref } from "@/lib/credits-display";

export type { LandingUser };

const SIGN_IN_HREF = `/signin?next=${encodeURIComponent("/?start=1")}`;

function initials(user: LandingUser): string {
  const name = (user.name ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
  }
  return ((user.email ?? "?").slice(0, 1)).toUpperCase();
}

function ProfileMenu({ user }: { user: LandingUser }) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const showImage = Boolean(user.image) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [user.image]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="nav-profile" ref={rootRef}>
      <button
        type="button"
        className="nav-profile-trigger"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={user.email ?? user.name ?? "Account"}
        onClick={() => setOpen((value) => !value)}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image!}
            alt=""
            className="nav-user-avatar"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="nav-user-avatar nav-user-initials" aria-hidden>
            {initials(user)}
          </span>
        )}
      </button>

      {open ? (
        <div className="nav-profile-menu" id={menuId} role="menu">
          {user.email ? <p className="nav-profile-email">{user.email}</p> : null}
          <Link href="/library" className="nav-profile-signout" role="menuitem" onClick={() => setOpen(false)}>
            Library
          </Link>
          <Link href="/billing" className="nav-profile-signout" role="menuitem" onClick={() => setOpen(false)}>
            Settings
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="nav-profile-signout" role="menuitem">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Caplio" className="nav-logo-img" />
        </Link>

        <nav className="nav-links">
          <a href={uploadHref === "#upload" ? "#upload" : "/#upload"}>Product</a>
          <a href={uploadHref === "#upload" ? "#styles" : "/#styles"}>Styles</a>
          {user ? <Link href="/library">Library</Link> : null}
          <Link href="/billing">Pricing</Link>
          <Link href="/style-request">Custom Style</Link>
        </nav>

        <div className="nav-actions">
          <Link
            href={user || canStart ? DASHBOARD_PATH : dashboardSignInHref()}
            className="nav-dashboard-cta"
          >
            Open Dashboard
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
          <ThemeToggle />
          {user ? (
            <ProfileMenu user={user} />
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
