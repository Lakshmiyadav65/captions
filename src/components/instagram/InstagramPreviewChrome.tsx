"use client";

import type { ReactNode } from "react";
import type { InstagramMockContent } from "@/lib/instagram/safe-zone";
import { INSTAGRAM_MOCK_CONTENT } from "@/lib/instagram/safe-zone";

/**
 * Reels chrome matched to a real iOS “Your reels” capture — visual-only, no IG API.
 * Spacing / icon stack mirrors the live app so caption safe-zone checks are meaningful.
 */
export function InstagramPreviewChrome({
  content = INSTAGRAM_MOCK_CONTENT,
  progressPct = 0,
}: {
  content?: InstagramMockContent;
  /** 0–100 scrubber fill under the reel (synced from editor playhead). */
  progressPct?: number;
}) {
  return (
    <div className="ed-ig-chrome" aria-hidden>
      <div className="ed-ig-top">
        <svg className="ed-ig-ico" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 5L8 12l7 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="ed-ig-top-label">Your reels</span>
        <svg className="ed-ig-ico" viewBox="0 0 24 24" fill="none">
          <rect
            x="4"
            y="7"
            width="16"
            height="12"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M9 7l1.2-2h3.6L15 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="ed-ig-rail">
        <RailBtn label={content.likes}>
          <svg viewBox="0 0 24 24" className="ed-ig-ico ed-ig-ico--liked">
            <path
              d="M12 21s-6.7-4.2-9.2-8.1C1 10.2 2.1 6.8 5.2 5.6c1.9-.7 3.9-.1 5.1 1.4 1.2-1.5 3.2-2.1 5.1-1.4 3.1 1.2 4.2 4.6 2.4 7.3C18.7 16.8 12 21 12 21z"
              fill="currentColor"
            />
          </svg>
        </RailBtn>
        <RailBtn label={content.comments}>
          <svg viewBox="0 0 24 24" className="ed-ig-ico" fill="none">
            <path
              d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7a2.5 2.5 0 01-2.5 2.5H11l-4.2 3.2c-.5.4-1.3 0-1.3-.6V6.5z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </RailBtn>
        <RailBtn label="">
          <svg viewBox="0 0 24 24" className="ed-ig-ico" fill="none">
            <rect
              x="3.5"
              y="8"
              width="10"
              height="10"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <rect
              x="10.5"
              y="4"
              width="10"
              height="10"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M7.2 12.2v2.2h2.2M16.8 9.8V7.6h-2.2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </RailBtn>
        <RailBtn label={content.shares}>
          <svg viewBox="0 0 24 24" className="ed-ig-ico" fill="none">
            <path
              d="M4.5 11.5L19 4.5l-3.2 15.2-4.1-5.4-5.5 1.4 2.8-6.2z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </RailBtn>
        <RailBtn label={content.saves}>
          <svg viewBox="0 0 24 24" className="ed-ig-ico" fill="none">
            <path
              d="M7 4.5h10a1 1 0 011 1V20l-6-3.6L6 20V5.5a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </RailBtn>
        <div className="ed-ig-rail-btn ed-ig-rail-more">
          <span className="ed-ig-dots" />
        </div>
        <div className="ed-ig-audio-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.audioThumbSrc} alt="" />
        </div>
      </div>

      <div className="ed-ig-bottom">
        <div className="ed-ig-translations">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path
              d="M5 7.5h9.5M9.5 4.5v3M8 7.5c.4 2.4 1.8 4.5 4.2 6.2M12.5 10c1.2 1.5 2.9 2.6 5 3.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M5.5 16.5h7M7 19.5c1.4-2.2 3.2-3.2 5.5-3.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          View translations
        </div>
        <div className="ed-ig-user-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ed-ig-user-avatar" src={content.avatarSrc} alt="" />
          <div className="ed-ig-user-meta">
            <b>{content.username}</b>
            <span>{content.tagline}</span>
          </div>
        </div>
        <p className="ed-ig-desc">{content.description}</p>
      </div>

      <div className="ed-ig-progress">
        <i style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
      </div>

      <div className="ed-ig-creator-bar">
        <span className="ed-ig-edits">
          <span className="ed-ig-edits-mark" aria-hidden />
          Get inspired on Edits
        </span>
        <span className="ed-ig-views">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path
              d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          </svg>
          {content.views} views
        </span>
        <span className="ed-ig-boost">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path
              d="M4 15.5l4.2-4.2 3.2 3.2L20 6.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15.5 6.5H20v4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Boost
        </span>
      </div>
    </div>
  );
}

function RailBtn({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ed-ig-rail-btn">
      {children}
      {label ? <small>{label}</small> : null}
    </div>
  );
}
