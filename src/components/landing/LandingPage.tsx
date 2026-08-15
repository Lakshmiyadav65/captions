"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Uploader } from "@/components/Uploader";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import type { LandingUser } from "@/components/landing/types";
import { getPresetById, PRESETS } from "@/components/presets";

export type { LandingUser };

const SIGN_IN_HREF = `/signin?next=${encodeURIComponent("/?start=1")}`;

/** Hero style demos — videos in /public/styles, mapped to Styles 2.0 preset IDs. */
const STRIP_STYLES = [
  {
    id: "karaoke",
    name: "Karaoke",
    src: "/styles/karaoke.mp4",
  },
  {
    id: "negative",
    name: "Negative",
    src: "/styles/negative.mp4",
  },
  {
    id: "negative-long",
    name: "Negative",
    /** Same Styles 2.0 preset — longer demo clip. */
    presetId: "negative",
    src: "/styles/negative-style.mp4",
  },
] as const;

function applyPendingStyle(presetId: string) {
  const preset = getPresetById(presetId);
  if (!preset || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem("pendingStyle", JSON.stringify(preset.style));
}

function resolvePresetId(item: (typeof STRIP_STYLES)[number]): string {
  return "presetId" in item && item.presetId ? item.presetId : item.id;
}

const STRIP_STYLE_STORAGE_KEY = "landingSelectedStyle";

function readStoredStyleId(): string {
  if (typeof sessionStorage === "undefined") return STRIP_STYLES[0].id;
  const stored = sessionStorage.getItem(STRIP_STYLE_STORAGE_KEY);
  if (stored && STRIP_STYLES.some((s) => s.id === stored)) return stored;
  // Migrate older strip IDs from pre–Styles 2.0.
  const legacy: Record<string, string> = {
    "live-cinetop": "karaoke",
    "live-karaoke": "karaoke",
    "live-negative": "negative",
    "live-negative-style": "negative-long",
  };
  if (stored && legacy[stored] && STRIP_STYLES.some((s) => s.id === legacy[stored])) {
    return legacy[stored]!;
  }
  return STRIP_STYLES[0].id;
}

/** Landing CSS demos keyed by Styles 2.0 `landingAnim` / id. */
const LANDING_SAMPLES: Record<string, ReactNode> = {
  classic: (
    <span className="lp-anim lp-anim-classic">
      <span>this</span> <span>is</span> <span>how</span> <span>you</span> <span>go</span>
    </span>
  ),
  bold: <span className="lp-anim lp-anim-bold lp-style-bold">this is how you</span>,
  highlight: (
    <span className="lp-anim lp-anim-highlight">
      <span>this</span> <span>is</span> <span>how</span> <span>you</span>
    </span>
  ),
  karaoke: (
    <span className="lp-anim lp-anim-karaoke">
      <span>this</span> <span>is</span> <span>how</span> <span>you</span> <span>go</span>
    </span>
  ),
  blur: (
    <span className="lp-anim lp-anim-blur">
      <span>this</span> <span>is</span> <span>how</span> <span>you</span>
    </span>
  ),
};

/** Styles 2.0 catalog → landing cards (same source of truth as the editor). */
const STYLE_PREVIEWS = PRESETS.map((p) => {
  const anim = p.landingAnim ?? "classic";
  return {
    id: p.id,
    name: p.name,
    tag: p.tag ?? p.category,
    anim,
    sample: LANDING_SAMPLES[anim] ?? LANDING_SAMPLES.classic,
    extra: !["classic", "bold", "highlight"].includes(p.id),
  };
});

const REELS = [
  {
    n: 1,
    src: "/styles/karaoke.mp4",
    creator: "@teluguhacks",
    style: "Karaoke",
    presetId: "karaoke",
  },
  {
    n: 2,
    src: "/styles/negative.mp4",
    creator: "@sirichats",
    style: "Negative",
    presetId: "negative",
  },
  {
    n: 3,
    src: "/styles/negative-style.mp4",
    creator: "@filmnotes.te",
    style: "Negative",
    presetId: "negative",
  },
  {
    n: 4,
    src: "/styles/karaoke.mp4",
    creator: "@dailytelugu",
    style: "Karaoke",
    presetId: "karaoke",
  },
] as const;

const FAQS = [
  {
    q: "How accurate is the Telugu AI speech transcription?",
    a: "Our Telugu speech model is tuned on conversational, code-mixed speech — the way creators actually talk. Clear audio typically lands in the 90%+ range, and you can fix anything in the editor before export.",
  },
  {
    q: "What is the difference between Romanized and Native Telugu captions?",
    a: "Romanized writes Telugu in English letters (“Namaskaram andi”) — fast to scan on mobile. Native uses Telugu script (నమస్కారం అండి). Switch either way in one click.",
  },
  {
    q: "Can I edit the Telugu captions before exporting?",
    a: "Yes. Edit words, retime lines, split or merge segments, and change the style — the preview updates live before you export.",
  },
  {
    q: "What video export formats are supported?",
    a: "Burned-in MP4 at up to 1080p, in 9:16, 1:1 or 16:9. You can also download the caption file (SRT) separately.",
  },
  {
    q: "Are my uploaded Telugu videos kept private?",
    a: "Private by default. Only you can see your uploads, and files are deleted from processing storage once your export is ready.",
  },
  {
    q: "Do I need to install any software?",
    a: "No. Everything runs in the browser, on phone or desktop. Upload, caption, export.",
  },
  {
    q: "Can I customize caption fonts and colors?",
    a: "Every style is adjustable — font, size, colour, highlight, outline, position and animation. Save your set as a preset for next time.",
  },
  {
    q: "What is the Custom Style feature?",
    a: "Send us a reference reel or describe the look you want. We build that caption style and add it to your account — usually within 24 hours.",
  },
] as const;

function CheckIcon({ light = false }: { light?: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke={light ? "#FF7A4F" : "#DE5227"}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function StartLink({
  canStart,
  className,
  children,
}: {
  canStart: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (canStart) {
    return (
      <a href="#upload" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={SIGN_IN_HREF} className={className}>
      {children}
    </Link>
  );
}

function BrandMark() {
  return (
    <span className="lp-brand">
      <span className="lp-brand-dot" aria-hidden />
      <span className="lp-brand-text">telugu captions</span>
    </span>
  );
}

function Hero({ canStart }: { canStart: boolean }) {
  const [selectedId, setSelectedId] = useState<string>(STRIP_STYLES[0].id);
  const selected = STRIP_STYLES.find((s) => s.id === selectedId) ?? STRIP_STYLES[0];

  useEffect(() => {
    setSelectedId(readStoredStyleId());
  }, []);

  useEffect(() => {
    const presetId = resolvePresetId(selected);
    applyPendingStyle(presetId);
    try {
      sessionStorage.setItem(STRIP_STYLE_STORAGE_KEY, selected.id);
    } catch {
      /* private mode */
    }
  }, [selected]);

  const selectStyle = (id: string) => {
    setSelectedId(id);
  };

  return (
    <section className="lp-hero" id="top">
      <div className="lp-container">
        <div className="lp-hero-copy">
          <h1 className="lp-display">
            Create <span className="lp-accent">Telugu</span> Captions in Seconds.
          </h1>
          <p className="lp-lead">
            Upload a Short, generate accurate Telugu captions, customize the style, and
            export a post-ready video in minutes.
          </p>
        </div>

        <div className="lp-upload-card" id="upload">
          <Uploader tone="light" canUpload={canStart} variant="landing" />
          <div className="lp-upload-bar">
            <div className="lp-upload-meta">
              <span className="lp-upload-attach" aria-hidden>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </span>
              <span className="lp-style-chip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 5h16v14H4z" />
                  <path d="M8 9h5" />
                  <path d="M8 13h8" />
                </svg>
                {selected.name}
              </span>
            </div>
            {canStart ? (
              <button
                type="button"
                className="lp-btn-dark"
                onClick={() => {
                  const drop = document.querySelector<HTMLElement>(".lp-uploader-drop");
                  drop?.click();
                }}
              >
                Upload Video
                <ArrowIcon />
              </button>
            ) : (
              <Link href={SIGN_IN_HREF} className="lp-btn-dark">
                Upload Video
                <ArrowIcon />
              </Link>
            )}
          </div>
        </div>

        <div className="lp-strip" role="listbox" aria-label="Caption styles">
          {STRIP_STYLES.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`lp-strip-card${isSelected ? " is-selected" : ""}`}
                onClick={() => selectStyle(item.id)}
              >
                <div className="lp-strip-preview lp-strip-preview--video">
                  <video
                    src={item.src}
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                    aria-hidden
                  />
                  <span className="lp-strip-label">{item.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StylesSection() {
  const [showAll, setShowAll] = useState(false);
  const visible = STYLE_PREVIEWS.filter((s) => showAll || !s.extra);

  return (
    <section className="lp-section" id="styles">
      <div className="lp-container">
        <div className="lp-section-intro">
          <span className="lp-eyebrow">Styles 2.0</span>
          <h2 className="lp-display-sm">14 Caption Styles</h2>
          <p className="lp-section-lead">
            Curated caption styles for Reels, Shorts, and social video — same set in the editor.
          </p>
        </div>

        <div className="lp-styles-grid">
          {visible.map((style, index) => (
            <button
              key={style.id}
              type="button"
              className={`lp-style-card lp-style-card--${style.anim}`}
              style={{ animationDelay: `${(index % 4) * 0.06}s` }}
              onClick={() => {
                applyPendingStyle(style.id);
                document.getElementById("upload")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              <div className="lp-style-preview">{style.sample}</div>
              <div className="lp-style-meta">
                <span>{style.name}</span>
                <span className="lp-mono-tag">{style.tag}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="lp-center">
          <button
            type="button"
            className="lp-btn-outline"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "View less" : "View more"}
            <span
              className="lp-chev"
              style={{ transform: `rotate(${showAll ? 180 : 0}deg)` }}
              aria-hidden
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

function ReelsSection() {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const CLIP_SEC = 5;

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const bind = (video: HTMLVideoElement) => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.loop = false;

      const restartClip = () => {
        try {
          video.currentTime = 0;
        } catch {
          /* ignore seek errors while loading */
        }
        void video.play().catch(() => {});
      };

      const onTimeUpdate = () => {
        if (video.currentTime >= CLIP_SEC) restartClip();
      };

      const onEnded = () => restartClip();

      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("ended", onEnded);
      restartClip();

      return () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("ended", onEnded);
        video.pause();
      };
    };

    // Bind after refs are attached; retry once next frame if needed.
    const attach = () => {
      const videos = videoRefs.current.filter(Boolean) as HTMLVideoElement[];
      if (videos.length === 0) return false;
      for (const video of videos) cleanups.push(bind(video));
      return true;
    };

    if (!attach()) {
      const id = requestAnimationFrame(() => {
        attach();
      });
      cleanups.push(() => cancelAnimationFrame(id));
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const useReelStyle = (presetId: string) => {
    applyPendingStyle(presetId);
    try {
      const match = STRIP_STYLES.find((s) => s.id === presetId);
      if (match) sessionStorage.setItem(STRIP_STYLE_STORAGE_KEY, match.id);
    } catch {
      /* private mode */
    }
    document.getElementById("upload")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="lp-section" id="reels">
      <div className="lp-container">
        <div className="lp-section-intro">
          <span className="lp-eyebrow">In the wild</span>
          <h2 className="lp-display-sm">See Reels in Action</h2>
          <p className="lp-section-lead">
            See how creators use our caption styles on real videos.
          </p>
        </div>

        <div className="lp-reels-grid">
          {REELS.map((reel, index) => (
            <div key={`${reel.n}-${reel.style}`} className="lp-reel-card">
              <div className="lp-reel-preview lp-reel-preview--video">
                <video
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  src={reel.src}
                  muted
                  playsInline
                  autoPlay
                  preload="auto"
                  aria-label={`${reel.style} reel preview`}
                />
                <span className="lp-reel-badge">
                  reel {reel.n} · {reel.style}
                </span>
              </div>
              <div className="lp-reel-meta">
                <span>{reel.creator}</span>
                <button
                  type="button"
                  className="lp-mono-tag lp-reel-style-btn"
                  onClick={() => useReelStyle(reel.presetId)}
                >
                  {reel.style}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ canStart }: { canStart: boolean }) {
  return (
    <section className="lp-section lp-pricing" id="pricing">
      <div className="lp-container">
        <div className="lp-section-intro lp-center-copy">
          <span className="lp-eyebrow">Pricing</span>
          <h2 className="lp-display-sm">Simple Pricing</h2>
          <p className="lp-section-lead">Choose the plan that fits your workflow.</p>
        </div>

        <div className="lp-pricing-grid">
          <div className="lp-price-card">
            <div className="lp-price-head">
              <span className="lp-mono-tag">Monthly</span>
              <p className="lp-price">
                ₹299<span> / month</span>
              </p>
            </div>
            <ul className="lp-price-features">
              <li><CheckIcon /> Unlimited videos</li>
              <li><CheckIcon /> All caption styles</li>
              <li><CheckIcon /> Burned MP4 export</li>
              <li><CheckIcon /> Romanized &amp; Telugu captions</li>
            </ul>
            <Link href="/billing" className="lp-btn-ghost">
              Start Monthly
            </Link>
          </div>

          <div className="lp-price-card">
            <div className="lp-price-head">
              <span className="lp-mono-tag">Weekly</span>
              <p className="lp-price">
                ₹59<span> / week</span>
              </p>
            </div>
            <ul className="lp-price-features">
              <li><CheckIcon /> 10 videos / day</li>
              <li><CheckIcon /> All caption styles</li>
              <li><CheckIcon /> Burned MP4 export</li>
              <li><CheckIcon /> Romanized &amp; Telugu captions</li>
            </ul>
            <Link href="/billing" className="lp-btn-ghost">
              Start Weekly
            </Link>
          </div>

          <div className="lp-price-card lp-price-featured">
            <div className="lp-price-head">
              <span className="lp-best-badge">Best to start</span>
              <span className="lp-mono-tag">Pay per video</span>
              <p className="lp-price lp-price-light">
                ₹9<span> / video</span>
              </p>
            </div>
            <ul className="lp-price-features lp-price-features-light">
              <li><CheckIcon light /> 1 video, no subscription</li>
              <li><CheckIcon light /> All caption styles</li>
              <li><CheckIcon light /> Burned MP4 export</li>
              <li><CheckIcon light /> Romanized &amp; Telugu captions</li>
            </ul>
            <StartLink canStart={canStart} className="lp-btn-light">
              Try One Video
            </StartLink>
          </div>
        </div>

        <div className="lp-prepaid" id="prepaid">
          <div className="lp-section-intro lp-center-copy">
            <h3 className="lp-display-sm" style={{ fontSize: "clamp(1.6rem, 3vw, 2rem)" }}>
              Prepaid Minutes
            </h3>
            <p className="lp-section-lead">Buy minutes once. Use them whenever you need.</p>
          </div>
          <div className="lp-prepaid-grid">
            <div className="lp-price-card">
              <div className="lp-price-head">
                <span className="lp-mono-tag">Prepaid</span>
                <p className="lp-price">
                  5<span> minutes</span>
                </p>
              </div>
              <p className="lp-prepaid-copy">Perfect for trying captions without a subscription.</p>
              <ul className="lp-price-features">
                <li><CheckIcon /> 5 minutes of caption processing</li>
                <li><CheckIcon /> No subscription</li>
                <li><CheckIcon /> Never expires</li>
                <li><CheckIcon /> Use anytime</li>
              </ul>
              <Link
                href={canStart ? "/billing?buy=minutes_5#prepaid" : `/signin?next=${encodeURIComponent("/billing?buy=minutes_5")}`}
                className="lp-btn-ghost"
              >
                Buy 5 Minutes
              </Link>
            </div>
            <div className="lp-price-card lp-price-featured">
              <div className="lp-price-head">
                <span className="lp-best-badge">Best value</span>
                <span className="lp-mono-tag">Prepaid</span>
                <p className="lp-price lp-price-light">
                  10<span> minutes</span>
                </p>
              </div>
              <p className="lp-prepaid-copy lp-prepaid-copy-light">
                More minutes for your next batch of videos.
              </p>
              <ul className="lp-price-features lp-price-features-light">
                <li><CheckIcon light /> 10 minutes of caption processing</li>
                <li><CheckIcon light /> No subscription</li>
                <li><CheckIcon light /> Never expires</li>
                <li><CheckIcon light /> Use anytime</li>
              </ul>
              <Link
                href={canStart ? "/billing?buy=minutes_10#prepaid" : `/signin?next=${encodeURIComponent("/billing?buy=minutes_10")}`}
                className="lp-btn-light"
              >
                Buy 10 Minutes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="lp-section" id="faq">
      <div className="lp-container lp-faq-grid">
        <div className="lp-faq-intro">
          <span className="lp-eyebrow">FAQ</span>
          <h2 className="lp-display-sm">Frequently Asked Questions</h2>
        </div>

        <div className="lp-faq-list">
          {FAQS.map((item, idx) => {
            const open = openIndex === idx;
            return (
              <div key={item.q} className={`lp-faq-item${open ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="lp-faq-trigger"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? -1 : idx)}
                >
                  <span>{item.q}</span>
                  <span className="lp-faq-icon" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                </button>
                {open ? <p className="lp-faq-answer">{item.a}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ canStart }: { canStart: boolean }) {
  return (
    <section className="lp-cta-wrap">
      <div className="lp-container">
        <div className="lp-cta-card">
          <span className="lp-eyebrow lp-cta-eyebrow">Ready to publish?</span>
          <h2 className="lp-display-sm lp-cta-title">Caption your next Short in minutes.</h2>
          <p className="lp-cta-subtitle">
            Upload once, style instantly, and export a creator-ready video in one flow.
          </p>
          <StartLink canStart={canStart} className="lp-btn-dark lp-cta-btn">
            Upload Video
            <ArrowIcon />
          </StartLink>
          <div className="lp-cta-points" aria-label="Caplio benefits">
            <span>Telugu + Romanized</span>
            <span>Style presets</span>
            <span>Burned MP4 export</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <Link href="/" className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Caplio" className="nav-logo-img" />
            </Link>
            <p>AI captions for Telugu creators.</p>
          </div>
          <div className="lp-footer-col">
            <span className="lp-mono-tag">Product</span>
            <a href="#styles">Styles</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lp-footer-col">
            <span className="lp-mono-tag">Legal</span>
            <a href="#faq">Privacy</a>
            <a href="#faq">Terms</a>
          </div>
          <div className="lp-footer-col">
            <span className="lp-mono-tag">Contact</span>
            <a href="mailto:hello@telugucaptions.ai">hello@telugucaptions.ai</a>
            <Link href="/style-request">Custom Style</Link>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 Telugu Captions</span>
          <span className="lp-footer-mark">
            Made in Hyderabad
            <small>made for Telugu creators</small>
          </span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage({
  canStart = true,
  authEnabled = false,
  user = null,
}: {
  canStart?: boolean;
  authEnabled?: boolean;
  user?: LandingUser | null;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") !== "1") return;
    const el = document.getElementById("upload");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("start");
    window.history.replaceState({}, "", url.pathname + url.hash);
  }, []);

  return (
    <div className="landing-page">
      <LandingNavbar canStart={canStart} user={user} />
      <Hero canStart={canStart} />
      <StylesSection />
      <ReelsSection />
      <PricingSection canStart={canStart} />
      <FaqSection />
      <CtaSection canStart={canStart} />
      <Footer />
      {authEnabled && !canStart ? (
        <p className="sr-only">Sign in required to start uploading.</p>
      ) : null}
    </div>
  );
}
