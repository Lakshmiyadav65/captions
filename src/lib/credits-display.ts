/** Safe to import from client components — no secrets, no Prisma. */

export const CREDITS_CHANGED_EVENT = "caplio:credits";

export function formatAvailableMinutes(minutes: number): string {
  const n = Math.round(minutes * 10) / 10;
  return `${n} min available`;
}

export { INSUFFICIENT_MINUTES_MESSAGE } from "./credits-catalog";

export const DASHBOARD_PATH = "/library";

export function dashboardSignInHref(): string {
  return `/signin?next=${encodeURIComponent(DASHBOARD_PATH)}`;
}

export function notifyCreditsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}
