import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { planFromPriceId } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !config.stripe.webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, config.stripe.webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const prices = {
    creator: config.stripe.priceCreator || undefined,
    pro: config.stripe.pricePro || undefined,
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId || session.mode !== "subscription") break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price.id ?? null;
        const plan = planFromPriceId(priceId, prices);
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeCustomerId:
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id,
            stripeSubscriptionId: subId,
            stripePriceId: priceId,
          },
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = userId
          ? await prisma.user.findUnique({ where: { id: userId } })
          : await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (!user) break;
        if (event.type === "customer.subscription.deleted" || sub.status === "canceled") {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan: "free",
              stripeSubscriptionId: null,
              stripePriceId: null,
            },
          });
        } else {
          const priceId = sub.items.data[0]?.price.id ?? null;
          const plan = planFromPriceId(priceId, prices);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan,
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId,
            },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook]", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
