"use client";

import {
  INSTAGRAM_SAFE_ZONE_V1,
  type InstagramSafeZoneConfig,
} from "@/lib/instagram/safe-zone";

/** Non-destructive obstruction / safe-band overlays for Reels caption placement. */
export function CaptionSafeZoneOverlay({
  config = INSTAGRAM_SAFE_ZONE_V1,
}: {
  config?: InstagramSafeZoneConfig;
}) {
  const zoneStyle = (r: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  }) => ({
    top: `${r.top}%`,
    left: `${r.left}%`,
    height: `${r.bottom - r.top}%`,
    width: `${r.right - r.left}%`,
  });

  return (
    <div className="ed-ig-safezones" aria-hidden>
      <div
        className="ed-ig-zone ed-ig-zone--blocked"
        style={zoneStyle(config.topUi)}
      >
        <span>Instagram UI</span>
      </div>
      <div
        className="ed-ig-zone ed-ig-zone--blocked"
        style={zoneStyle(config.rightRail)}
      >
        <span>UI</span>
      </div>
      <div
        className="ed-ig-zone ed-ig-zone--warn"
        style={zoneStyle(config.bottomMeta)}
      >
        <span>Username / audio</span>
      </div>
      <div
        className="ed-ig-zone ed-ig-zone--safe"
        style={zoneStyle(config.safeBand)}
      >
        <span>Keep important text here</span>
      </div>
    </div>
  );
}
