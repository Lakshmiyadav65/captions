// Subscription plan limits. Env QUOTA_* is the Free-tier baseline; paid plans override
// when Razorpay billing is wired (soft launch = Free only).

export type PlanId = "free" | "creator" | "pro";

export interface PlanLimits {
  id: PlanId;
  label: string;
  monthlyMinutes: number;
  maxActiveJobs: number;
  /** Legacy Stripe env key — unused; Razorpay plan ids will replace this. */
  priceEnvKey: "STRIPE_PRICE_CREATOR" | "STRIPE_PRICE_PRO" | null;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: "free",
    label: "Free",
    monthlyMinutes: 120,
    maxActiveJobs: 3,
    priceEnvKey: null,
  },
  creator: {
    id: "creator",
    label: "Creator",
    monthlyMinutes: 600,
    maxActiveJobs: 5,
    priceEnvKey: "STRIPE_PRICE_CREATOR",
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyMinutes: 3000,
    maxActiveJobs: 10,
    priceEnvKey: "STRIPE_PRICE_PRO",
  },
};

export function isPlanId(v: string | null | undefined): v is PlanId {
  return v === "free" || v === "creator" || v === "pro";
}

export function planFromPriceId(
  priceId: string | null | undefined,
  prices: { creator?: string; pro?: string },
): PlanId {
  if (!priceId) return "free";
  if (prices.pro && priceId === prices.pro) return "pro";
  if (prices.creator && priceId === prices.creator) return "creator";
  return "free";
}
