"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Uploader } from "@/components/Uploader";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import type { LandingUser } from "@/components/landing/types";

export type { LandingUser };

const SIGN_IN_HREF = `/signin?next=${encodeURIComponent("/?start=1")}`;

function ScrollReveal({
  children,
  className = "",
  delay = 0,
  scale = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  scale?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible
      ? "translateY(0) scale(1)"
      : `translateY(32px) ${scale ? "scale(0.95)" : "scale(1)"}`,
    transition: `opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    willChange: "opacity, transform",
  } as const;

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}

function StartFreeLink({
  canStart,
  className,
  style,
  children = "Start free",
}: {
  canStart: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  if (canStart) {
    return (
      <a href="#upload" className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link href={SIGN_IN_HREF} className={className} style={style}>
      {children}
    </Link>
  );
}

function FlowIcon({ name }: { name: "upload" | "fix" | "export" }) {
  const paths = {
    upload:
      "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5",
    fix: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10",
    export:
      "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3",
  } as const;

  return (
    <div className="flow-icon" aria-hidden>
      <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
      </svg>
    </div>
  );
}

function Hero({ canStart }: { canStart: boolean }) {
  return (
    <section className="hero-section" id="product">
      <div className="container hero-container">
        <ScrollReveal delay={0}>
          <h1 className="hero-title">
            AI that captions Telugu videos like a native creator would.
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={0.15} scale>
          <div className="hero-mockup-frame" id="upload">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot-red" />
                <span className="dot-amber" />
                <span className="dot-green" />
              </div>
              <div className="mockup-title-label">Create captions</div>
              <div className="mockup-header-meta">
                <span className="mockup-chip">Soft launch</span>
                <span className="mockup-formats">MP4 · SRT · VTT · ASS</span>
              </div>
            </div>

            <div className="mockup-workspace">
              <div className="workspace-stage">
                <div className="workspace-preview" aria-hidden>
                  <div className="preview-phone">
                    <div className="preview-phone-screen">
                      <div className="preview-grad" />
                      <div className="preview-caption">
                        <span className="preview-caption-word">Namaskaram</span>
                        <span className="preview-caption-word is-active">andi!</span>
                      </div>
                      <div className="preview-phone-home" />
                    </div>
                  </div>
                  <p className="preview-caption-note">Preview of styled captions</p>
                </div>

                <div className="workspace-upload">
                  <p className="workspace-lead">
                    Drop a Telugu Reel or Short. Get timed romanized captions, style
                    them live, and export a burned MP4 ready to post.
                  </p>
                  <Uploader tone="light" canUpload={canStart} />
                </div>
              </div>

              <ol className="workspace-flow">
                <li>
                  <FlowIcon name="upload" />
                  <div>
                    <strong>Upload</strong>
                    <span>Telugu + English code-mix transcription</span>
                  </div>
                </li>
                <li>
                  <FlowIcon name="fix" />
                  <div>
                    <strong>Fix & learn</strong>
                    <span>Corrections stick for your next videos</span>
                  </div>
                </li>
                <li>
                  <FlowIcon name="export" />
                  <div>
                    <strong>Export</strong>
                    <span>Burned MP4 or SRT / VTT / ASS</span>
                  </div>
                </li>
              </ol>

              <div className="workspace-tools">
                <Link href="/style-analyzer" className="workspace-tool-primary">
                  <span className="tool-icon" aria-hidden>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.362-.126-.552-.3-.752A24.866 24.866 0 0012 15c2.072 0 4.028.368 5.85 1.044-.174.2-.3.39-.3.752a4.5 4.5 0 008.4 2.245 2.25 2.25 0 01-2.4-2.245 3 3 0 00-5.78-1.128 2.998 2.998 0 00-.78-2.122M15.75 9V5.677M12 10.5V4.875m-3.75 5.25V7.875"
                      />
                    </svg>
                  </span>
                  <span>
                    <strong>Style Analyzer</strong>
                    <em>Clone any Reel caption look from a screenshot</em>
                  </span>
                  <span className="tool-arrow" aria-hidden>
                    →
                  </span>
                </Link>
                <Link href="/style-request" className="workspace-tool-primary">
                  <span className="tool-icon" aria-hidden>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <span>
                    <strong>24h Style (Beta)</strong>
                    <em>Request any look — we add it to your presets</em>
                  </span>
                  <span className="tool-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function FeaturesSplit() {
  return (
    <section className="features-split-section">
      <div className="container split-container">
        <ScrollReveal delay={0}>
          <div className="split-text">
            <h2 className="section-title">
              Make viral Telugu Reels & Shorts, in minutes.
            </h2>

            <div className="feature-bullet-list">
              <div className="bullet-item">
                <h3>Romanized Telugu by Default</h3>
                <p>
                  Auto-generate clear Telugu captions in English script (e.g.,
                  &quot;Namaskaram andi!&quot;), proven to get 3x higher retention on
                  social feeds.
                </p>
              </div>

              <div className="bullet-item">
                <h3>Native Telugu Script Switch</h3>
                <p>
                  Switch to traditional Telugu script (నమస్కారం అండి!) with a
                  single tap while maintaining frame-accurate timing.
                </p>
              </div>

              <div className="bullet-item">
                <h3>Burned-In Export Ready to Post</h3>
                <p>
                  Export high-definition MP4 videos with animated, styled
                  captions burned directly into your video for Reels & Shorts.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2} scale>
          <div className="split-media">
            <div className="phone-card-container">
              <div className="blank-image-placeholder phone-placeholder" />
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function TwoCardSection() {
  return (
    <section className="two-card-section">
      <div className="container">
        <ScrollReveal delay={0}>
          <h2 className="section-title center-title">
            Caption existing videos or generate from scratch.
          </h2>
        </ScrollReveal>

        <div className="cards-grid-two">
          <ScrollReveal delay={0.1} scale>
            <div className="feature-card">
              <div className="card-media-box">
                <div className="blank-image-placeholder card-placeholder-1" />
              </div>
              <div className="card-body">
                <h3>Telugu AI Edit</h3>
                <p>
                  Upload raw Telugu video clips. AI automatically removes silent
                  pauses, generates accurate Telugu captions, applies zoom cuts,
                  and formats for Reels & Shorts.
                </p>
                <a href="#upload" className="btn-primary" style={{ marginTop: 16 }}>
                  Start editing
                </a>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2} scale>
            <div className="feature-card">
              <div className="card-media-box">
                <div className="blank-image-placeholder card-placeholder-2" />
              </div>
              <div className="card-body">
                <h3>Telugu AI Creator</h3>
                <p>
                  Script, generate, and caption entire Telugu videos from text
                  prompts. Perfect for Telugu creators, marketers, and digital
                  brands.
                </p>
                <a href="#upload" className="btn-primary" style={{ marginTop: 16 }}>
                  Get started
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function GridFeatures() {
  const features = [
    {
      title: "Auto Telugu Captions",
      desc: "Generate accurate Telugu subtitles in seconds with custom fonts and animated word highlights.",
      icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z",
    },
    {
      title: "AI Telugu Dubbing",
      desc: "Translate your videos into Telugu or dub Telugu speech into 100+ global languages seamlessly.",
      icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z",
    },
    {
      title: "Telugu AI Presenters",
      desc: "Create realistic digital avatars speaking Telugu fluently from text scripts.",
      icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    },
    {
      title: "Eye Contact Correction",
      desc: "Keep your gaze focused on your Telugu audience while reading script prompts.",
      icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    },
    {
      title: "Noise Removal",
      desc: "Strip background noise, fan hums, and room echo for crystal-clear Telugu speech.",
      icon: "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z",
    },
    {
      title: "Telugu Teleprompter",
      desc: "Read Telugu scripts smoothly off your screen while keeping eyes on the camera lens.",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      title: "AI Background Music",
      desc: "Generate royalty-free background audio tracks tailored to your video mood.",
      icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zM9 10l12-3",
    },
    {
      title: "Auto Punch Zoom",
      desc: "Add dynamic zoom emphasis to key Telugu words and punchlines automatically.",
      icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7",
    },
    {
      title: "Viral Video Compressor",
      desc: "Export crisp HD MP4 videos optimized for Instagram Reels, YouTube Shorts, and Moj.",
      icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
    },
  ];

  return (
    <section className="grid-features-section" id="features">
      <div className="container">
        <ScrollReveal delay={0}>
          <h2 className="section-title center-title">
            Everything you need to grow your Telugu audience.
          </h2>
        </ScrollReveal>

        <div className="features-grid-3x3">
          {features.map((item, index) => (
            <ScrollReveal key={item.title} delay={(index % 3) * 0.1}>
              <div className="grid-item">
                <div className="grid-icon">
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d={item.icon} />
                  </svg>
                </div>
                <div className="grid-content">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActionSection() {
  const cards = [
    { label: "Fluency", delay: 0.1 },
    { label: "Style", delay: 0.2 },
    { label: "Pace", delay: 0.3 },
  ];

  return (
    <section className="action-section">
      <div className="container">
        <ScrollReveal delay={0}>
          <h2 className="section-title center-title">
            See Telugu AI Captioning in action
          </h2>
          <p className="section-subtitle">
            Watch how AI turns raw Telugu speech into high-engagement, captioned
            video clips.
          </p>
        </ScrollReveal>

        <div className="video-triplet-grid">
          {cards.map((item) => (
            <ScrollReveal key={item.label} delay={item.delay} scale>
              <div className="video-card-item">
                <div className="blank-image-placeholder video-frame-placeholder" />
                <span className="video-card-label">{item.label}</span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function BrandsSection() {
  const brands = [
    "Instagram Reels",
    "YouTube Shorts",
    "Moj",
    "Josh",
    "Facebook Reels",
    "YouTube",
    "Snapchat",
    "MX TakaTak",
  ];

  return (
    <section className="brands-section">
      <div className="brands-marquee-wrapper">
        <div className="brands-marquee-track">
          <div className="brands-logo-row">
            {brands.map((b) => (
              <span key={b} className="brand-text">
                {b}
              </span>
            ))}
          </div>
          <div className="brands-logo-row" aria-hidden="true">
            {brands.map((b) => (
              <span key={`dup-${b}`} className="brand-text">
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { num: "10M+", label: "Telugu Views Generated", delay: 0.1 },
    { num: "2 Scripts", label: "Romanized & Native Telugu", delay: 0.2 },
    { num: "100+", label: "Viral Caption Presets", delay: 0.3 },
  ];

  return (
    <section className="stats-section">
      <div className="container stats-grid">
        {stats.map((st) => (
          <ScrollReveal key={st.label} delay={st.delay}>
            <div className="stat-box">
              <div className="stat-number">{st.num}</div>
              <div className="stat-label">{st.label}</div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

function StyleRequestSection({ canStart }: { canStart: boolean }) {
  const href = canStart
    ? "/style-request"
    : `/signin?next=${encodeURIComponent("/style-request")}`;
  return (
    <section className="style-request-section" id="custom-style">
      <div className="container">
        <ScrollReveal delay={0}>
          <div className="style-request-panel">
            <div className="style-request-copy">
              <span className="style-request-badge">Beta</span>
              <h2 className="section-title">
                Seen a caption style you love? Get it in 24 hours.
              </h2>
              <p className="style-request-lead">
                Creators chase looks across Reels and Shorts, then burn hours rebuilding them.
                Tell us the style, upload a reference video (preferred) or screenshot, and
                we&apos;ll craft it into your presets — usually within a day.
              </p>
              <Link href={href} className="btn-primary style-request-cta">
                Request a style
              </Link>
            </div>
            <ul className="style-request-steps" aria-label="How custom style requests work">
              <li>
                <strong>1. Sign in</strong>
                <span>Only signed-in creators can submit a request.</span>
              </li>
              <li>
                <strong>2. Upload a reference</strong>
                <span>A short clip of the look works best; screenshots work too.</span>
              </li>
              <li>
                <strong>3. Find it in presets</strong>
                <span>We deliver to My Styles within about 24 hours.</span>
              </li>
            </ul>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function CtaSection({ canStart, user }: { canStart: boolean; user: LandingUser | null }) {
  return (
    <section className="cta-section">
      <div className="container cta-container">
        <ScrollReveal delay={0}>
          <h2 className="section-title center-title">
            Start captioning your Telugu videos
          </h2>
          <p className="section-subtitle">
            Join thousands of Telugu creators making faster, higher-retention
            videos with AI.
          </p>

          <StartFreeLink
            canStart={canStart}
            className="btn-primary"
            style={{ fontSize: 16, padding: "14px 32px" }}
          >
            {user ? "Upload a video" : "Start for free"}
          </StartFreeLink>
        </ScrollReveal>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "How accurate is the Telugu AI speech transcription?",
      a: "Our speech recognition model is trained on diverse Telugu dialects and conversational speech. For any minor misinterpretations, our built-in editor lets you fix wording and timestamp alignment in seconds.",
    },
    {
      q: "What is the difference between Romanized and Native Telugu captions?",
      a: 'Romanized Telugu displays spoken Telugu in English letters (e.g. "Namaskaram andi!"), which gets 3x higher retention on Instagram Reels and YouTube Shorts. One click switches to native Telugu script (నమస్కారం అండి!) anytime.',
    },
    {
      q: "Can I edit the Telugu captions before exporting?",
      a: "Yes. Every generated transcript opens in our built-in visual editor. You can tweak individual words, fix timing, adjust positions, and change styling presets before exporting your final video.",
    },
    {
      q: "What video export formats are supported?",
      a: "You can export a burned-in HD MP4 video ready to upload to Instagram Reels, YouTube Shorts, or TikTok — as well as standalone subtitle files in SRT, VTT, and ASS formats.",
    },
    {
      q: "Are my uploaded Telugu videos kept private?",
      a: "Yes. Your uploads are processed strictly for your project. We never share your footage or use your private video data to train public AI models.",
    },
    {
      q: "Do I need to install any software to use Telugu Captions?",
      a: "No. Everything runs seamlessly in your web browser — video upload, transcription, visual styling, and video rendering happen in one unified web workflow.",
    },
    {
      q: "Can I customize the Telugu caption fonts and colors?",
      a: "Absolutely. You can choose from 100+ caption presets, or customize font family, font size, stroke color, active word highlight color, background box, and position.",
    },
    {
      q: "What is the 24-hour Style (Beta) feature?",
      a: "If you see a caption look on Instagram or YouTube that you want on your videos, sign in, open 24h Style, and upload a reference video or screenshot. We handcraft that style into your presets—usually within about 24 hours. For an instant match from a screenshot, use Style Analyzer.",
    },
  ];

  return (
    <section className="faq-section" id="faq">
      <div className="container faq-container">
        <ScrollReveal delay={0}>
          <h2 className="section-title center-title">Frequently asked questions</h2>
        </ScrollReveal>

        <div className="faq-accordion">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <ScrollReveal key={item.q} delay={idx * 0.05}>
                <div className={`faq-item ${isOpen ? "active" : ""}`}>
                  <button
                    type="button"
                    className="faq-trigger"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                  >
                    <span>{item.q}</span>
                    <svg
                      className="faq-chevron"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="faq-content">
                    <p>{item.a}</p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/" className="logo footer-logo">
              <img src="/logo.png" alt="Caplio" className="nav-logo-img" />
            </Link>
            <div className="social-links">
              <a href="#" aria-label="Twitter">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="#" aria-label="YouTube">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="footer-columns">
            <div className="footer-col">
              <h5>Product</h5>
              <a href="#features">Features</a>
              <Link href="/billing">Pricing</Link>
              <a href="#upload">Web Editor</a>
              <a href="#upload">Desktop App</a>
              <a href="#upload">Mobile App</a>
            </div>

            <div className="footer-col">
              <h5>Use Cases</h5>
              <a href="#product">Telugu Creators</a>
              <a href="#product">Marketers</a>
              <a href="#product">Businesses</a>
              <a href="#product">Educators</a>
              <a href="#product">Agencies</a>
            </div>

            <div className="footer-col">
              <h5>AI Tools</h5>
              <a href="#upload">Telugu Subtitle Generator</a>
              <a href="#features">Telugu AI Dubbing</a>
              <a href="#features">Voice Generator</a>
              <a href="#features">Eye Contact</a>
              <a href="#features">Noise Remover</a>
            </div>

            <div className="footer-col">
              <h5>Resources</h5>
              <a href="#faq">Help Center</a>
              <a href="#faq">Telugu Guides</a>
              <Link href="/style-analyzer">Style Analyzer</Link>
              <Link href="/style-request">24h Style (Beta)</Link>
              <Link href="/styles">My Styles</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Telugu Captions, Inc. All rights reserved.</p>
          <div className="footer-legal">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
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
    // Clean the query without a full reload.
    const url = new URL(window.location.href);
    url.searchParams.delete("start");
    window.history.replaceState({}, "", url.pathname + url.hash);
  }, []);

  return (
    <div className="landing-page">
      <div className="grain-texture" />
      <div className="ambient-background">
        <div className="glow glow-top-left" />
        <div className="glow glow-top-right" />
        <div className="glow glow-bottom" />
        <div className="glow glow-bottom-right" />
      </div>

      <LandingNavbar canStart={canStart} user={user} />
      <Hero canStart={canStart} />
      <FeaturesSplit />
      <TwoCardSection />
      <GridFeatures />
      <ActionSection />
      <BrandsSection />
      <StatsSection />
      <StyleRequestSection canStart={canStart} />
      <CtaSection canStart={canStart} user={user} />
      <FaqSection />
      <Footer />
      {authEnabled && !canStart ? (
        <p className="sr-only">Sign in required to start uploading.</p>
      ) : null}
    </div>
  );
}
