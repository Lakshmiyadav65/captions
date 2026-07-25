import Stripe from "stripe";
import { config } from "./config";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!config.stripeEnabled) return null;
  if (!_stripe) {
    _stripe = new Stripe(config.stripe.secretKey);
  }
  return _stripe;
}

export function stripePriceIdForPlan(plan: "creator" | "pro"): string {
  return plan === "pro" ? config.stripe.pricePro : config.stripe.priceCreator;
}
