function CharminarIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M6 28V14.5L8.2 12.2V8.5L10 6.8V10h2.2V6.2L16 3l3.8 3.2V10H22V6.8L23.8 8.5v3.7L26 14.5V28"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M11.2 28v-6.2c0-2.6 1.9-4.2 4.8-4.2s4.8 1.6 4.8 4.2V28"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6 28h20M8.4 18.2h15.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HyderabadMark({
  variant = "default",
}: {
  variant?: "default" | "hero";
}) {
  return (
    <span className={`lp-city-mark lp-city-mark--${variant}`}>
      <span className="lp-city-mark-icon" aria-hidden>
        <CharminarIcon />
      </span>
      <span className="lp-city-mark-copy">
        <b>Made in Hyderabad</b>
        <small>made for Telugu creators</small>
      </span>
    </span>
  );
}
