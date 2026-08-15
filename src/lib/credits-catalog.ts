export type CreditPackId = "minutes_5" | "minutes_10";
export type CreditTxnType = "GRANT" | "PURCHASE" | "USAGE" | "REFUND" | "ADJUSTMENT";

export const CREDIT_PACKS: Record<
  CreditPackId,
  {
    id: CreditPackId;
    name: string;
    minutes: number;
    recommended?: boolean;
    priceEnvKey: "STRIPE_PRICE_MINUTES_5" | "STRIPE_PRICE_MINUTES_10";
  }
> = {
  minutes_5: {
    id: "minutes_5",
    name: "5 Minutes",
    minutes: 5,
    priceEnvKey: "STRIPE_PRICE_MINUTES_5",
  },
  minutes_10: {
    id: "minutes_10",
    name: "10 Minutes",
    minutes: 10,
    recommended: true,
    priceEnvKey: "STRIPE_PRICE_MINUTES_10",
  },
};

export function isCreditPackId(v: unknown): v is CreditPackId {
  return v === "minutes_5" || v === "minutes_10";
}

export function minutesFromDurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.round((sec / 60) * 10) / 10;
}

/** Prepaid minutes needed after monthly quota is applied. */
export function prepaidMinutesNeeded(
  monthlyMinutes: number,
  usedMinutes: number,
  videoMinutes: number,
): number {
  const remaining = Math.max(0, monthlyMinutes - usedMinutes);
  return Math.max(0, Math.round((videoMinutes - remaining) * 10) / 10);
}

export const INSUFFICIENT_MINUTES_MESSAGE =
  "You don't have enough caption minutes for this video.";

export class InsufficientCreditsError extends Error {
  readonly code = "quota_minutes" as const;
  constructor(message?: string) {
    super(message ?? INSUFFICIENT_MINUTES_MESSAGE);
    this.name = "InsufficientCreditsError";
  }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type FreeUsageSettings = {
  testUserEmail: string;
  testMinutes: number;
  normalMinutes: number;
};

/** Server-side allocation. The client cannot choose 5 vs 120. */
export function allocationForEmail(
  email: string | null | undefined,
  settings: FreeUsageSettings,
): number {
  const addr = (email ?? "").trim().toLowerCase();
  const test = settings.testUserEmail.trim().toLowerCase();
  if (test && addr && addr === test) {
    return round1(Math.max(0, settings.testMinutes));
  }
  return round1(Math.max(0, settings.normalMinutes));
}
