"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Uploader } from "@/components/Uploader";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import type { LandingUser } from "@/components/landing/types";
import { PRESETS } from "@/components/presets";

export type { LandingUser };

const SIGN_IN_HREF = `/signin?next=${encodeURIComponent("/?start=1")}`;

/** Hero style demos — videos in /public/styles, mapped to real presets. */
const STRIP_STYLES = [
  {
    id: "live-cinetop",
    name: "Cinetop",
    src: "/styles/cinetop.mp4",
  },
  {
    id: "live-karaoke",
    name: "Karaoke",
    src: "/styles/karaoke.mp4",
  },
  {
    id: "live-negative",
    name: "Negative",
    src: "/styles/negative.mp4",
  },
  {
    id: "live-negative-style",
    name: "Negative Style",
    /** Same preset as Negative — longer demo clip. */
    presetId: "live-negative",
    src: "/styles/negative-style.mp4",
  },
  {
    id: "premium-5",
    name: "Premium Style 5",
    src: "/styles/premium-style-5.mp4",
  },
] as const;

function applyPendingStyle(presetId: string) {
  const preset = PRESETS.find((p) => p.id === presetId);
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
  return STRIP_STYLES[0].id;
}

const STYLE_PREVIEWS = [
  {
    name: "Classic",
    tag: "Default",
    anim: "classic",
    sample: (
      <span className="lp-anim lp-anim-classic">
        <span>this</span> <span>is</span> <span>how</span> <span>you</span> <span>go</span>
      </span>
    ),
  },
  {
    name: "Bold",
    tag: "Impact",
    anim: "bold",
    sample: <span className="lp-anim lp-anim-bold lp-style-bold">this is how you</span>,
  },
  {
    name: "Minimal",
    tag: "Quiet",
    anim: "minimal",
    sample: <span className="lp-anim lp-anim-minimal lp-style-minimal">this is how you</span>,
  },
  {
    name: "Highlight",
    tag: "Aesthetic",
    anim: "highlight",
    sample: (
      <span className="lp-anim lp-anim-highlight">
        <span>this</span> <span>is</span> <span>how</span> <span>you</span>
      </span>
    ),
  },
  {
    name: "Punch",
    tag: "One word",
    anim: "punch",
    sample: <span className="lp-anim lp-anim-punch lp-style-punch">you</span>,
  },
  {
    name: "Glow",
    tag: "Aesthetic",
    anim: "glow",
    sample: <span className="lp-anim lp-anim-glow lp-style-glow">this is how you</span>,
  },
  {
    name: "Outline",
    tag: "Editorial",
    anim: "outline",
    sample: <span className="lp-anim lp-anim-outline lp-style-outline">you</span>,
  },
  {
    name: "Typewriter",
    tag: "Build",
    anim: "type",
    sample: (
      <span className="lp-anim lp-anim-type lp-style-type">
        <span className="lp-type-text">this is how you</span>
        <span className="lp-type-cursor" aria-hidden>
          |
        </span>
      </span>
    ),
  },
  {
    name: "Cinema",
    tag: "Cinematic",
    anim: "cinema",
    sample: <span className="lp-anim lp-anim-cinema lp-style-cinema">this is how you</span>,
    extra: true,
  },
  {
    name: "Karaoke",
    tag: "Sync",
    anim: "karaoke",
    sample: (
      <span className="lp-anim lp-anim-karaoke">
        <span>this</span> <span>is</span> <span>how</span> <span>you</span> <span>go</span>
      </span>
    ),
    extra: true,
  },
  {
    name: "Blur",
    tag: "Soft focus",
    anim: "blur",
    sample: (
      <span className="lp-anim lp-anim-blur">
        <span>this</span> <span>is</span> <span>how</span> <span>you</span>
      </span>
    ),
    extra: true,
  },
  {
    name: "Motion",
    tag: "Cinematic",
    anim: "motion",
    sample: (
      <span className="lp-anim lp-anim-motion lp-style-motion">
        <span>this</span>
        <span>is</span>
        <span>how</span>
        <span>you</span>
      </span>
    ),
    extra: true,
  },
] as const;

const REELS = [
  {
    n: 1,
    src: "/styles/cinetop.mp4",
    creator: "@ravi.cooks",
    style: "Cinetop",
    presetId: "live-cinetop",
  },
  {
    n: 2,
    src: "/styles/karaoke.mp4",
    creator: "@teluguhacks",
    style: "Karaoke",
    presetId: "live-karaoke",
  },
  {
    n: 3,
    src: "/styles/negative.mp4",
    creator: "@sirichats",
    style: "Negative",
    presetId: "live-negative",
  },
  {
    n: 4,
    src: "/styles/negative-style.mp4",
    creator: "@filmnotes.te",
    style: "Negative Style",
    presetId: "live-negative",
  },
  {
    n: 5,
    src: "/styles/premium-style-5.mp4",
    creator: "@moneytelugu",
    style: "Premium Style 5",
    presetId: "premium-5",
  },
  /** Duplicate of Karaoke so the grid shows 6 reels. */
  {
    n: 6,
    src: "/styles/karaoke.mp4",
    creator: "@dailytelugu",
    style: "Karaoke",
    presetId: "live-karaoke",
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
  const stripRef = useRef<HTMLDivElement>(null);
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

  const scrollStrip = (dir: number) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.max(220, el.clientWidth * 0.7),
      behavior: "smooth",
    });
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

        <div className="lp-strip">
          <button
            type="button"
            className="lp-strip-nav"
            aria-label="Previous styles"
            onClick={() => scrollStrip(-1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 6l-6 6 6 6" />
            </svg>
          </button>
          <div className="lp-strip-track" ref={stripRef} role="listbox" aria-label="Caption styles">
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
          <button
            type="button"
            className="lp-strip-nav"
            aria-label="Next styles"
            onClick={() => scrollStrip(1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function StylesSection() {
  const [showAll, setShowAll] = useState(false);
  const visible = STYLE_PREVIEWS.filter((s) => showAll || !("extra" in s && s.extra));

  return (
    <section className="lp-section" id="styles">
      <div className="lp-container">
        <div className="lp-section-intro">
          <span className="lp-eyebrow">Live, not screenshots</span>
          <h2 className="lp-display-sm">20+ Caption Styles</h2>
          <p className="lp-section-lead">
            Modern caption styles designed for Reels, Shorts, and social video.
          </p>
        </div>

        <div className="lp-styles-grid">
          {visible.map((style, index) => (
            <div
              key={style.name}
              className={`lp-style-card lp-style-card--${style.anim}`}
              style={{ animationDelay: `${(index % 4) * 0.06}s` }}
            >
              <div className="lp-style-preview">{style.sample}</div>
              <div className="lp-style-meta">
                <span>{style.name}</span>
                <span className="lp-mono-tag">{style.tag}</span>
              </div>
            </div>
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
  const [playing, setPlaying] = useState<number | null>(null);

  const togglePlay = (index: number) => {
    const video = videoRefs.current[index];
    if (!video) return;

    if (playing === index && !video.paused) {
      video.pause();
      setPlaying(null);
      return;
    }

    videoRefs.current.forEach((v, i) => {
      if (v && i !== index) v.pause();
    });
    void video.play();
    setPlaying(index);
  };

  const useReelStyle = (presetId: string) => {
    applyPendingStyle(presetId);
    try {
      const match = STRIP_STYLES.find(
        (s) => s.id === presetId || ("presetId" in s && s.presetId === presetId),
      );
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
          {REELS.map((reel, index) => {
            const isPlaying = playing === index;
            return (
              <div key={`${reel.n}-${reel.style}`} className="lp-reel-card">
                <div
                  className="lp-reel-preview lp-reel-preview--video"
                  onClick={() => togglePlay(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      togglePlay(index);
                    }
                  }}
                  aria-label={`${isPlaying ? "Pause" : "Play"} ${reel.style} reel`}
                >
                  <video
                    ref={(el) => {
                      videoRefs.current[index] = el;
                    }}
                    src={reel.src}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onEnded={() => setPlaying(null)}
                    onPause={() => {
                      if (playing === index) setPlaying(null);
                    }}
                  />
                  <span className="lp-reel-badge">
                    reel {reel.n} · {reel.style}
                  </span>
                  <span className={`lp-reel-play${isPlaying ? " is-playing" : ""}`} aria-hidden>
                    {isPlaying ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
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
            );
          })}
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
          <h2 className="lp-display-sm lp-cta-title">Caption your next Short in minutes.</h2>
          <StartLink canStart={canStart} className="lp-btn-dark">
            Upload Video
            <ArrowIcon />
          </StartLink>
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
            <span className="lp-brand">
              <span className="lp-brand-dot" aria-hidden />
              <span className="lp-brand-text">caplio</span>
            </span>
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
          <span>Made in India</span>
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
