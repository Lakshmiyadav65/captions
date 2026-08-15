import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { CREDIT_PACKS, isCreditPackId, stripePriceIdForPack } from "@/lib/credits";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured (missing STRIPE_SECRET_KEY)." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { pack_id?: string; packId?: string };
  const packId = body.pack_id ?? body.packId;
  if (!isCreditPackId(packId)) {
    return NextResponse.json(
      { error: "pack_id must be minutes_5 or minutes_10" },
      { status: 400 },
    );
  }

  const pack = CREDIT_PACKS[packId];
  const priceId = stripePriceIdForPack(packId);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price not set for ${packId}. Set ${pack.priceEnvKey}.` },
      { status: 503 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const purchase = await prisma.creditPurchase.create({
    data: {
      userId,
      packId,
      minutes: pack.minutes,
      paymentProvider: "stripe",
      status: "PENDING",
    },
  });

  const base = config.stripe.appUrl || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/billing?credits=success&pack=${packId}`,
    cancel_url: `${base}/billing?credits=canceled`,
    metadata: {
      userId,
      kind: "credits",
      packId,
      purchaseId: purchase.id,
    },
    payment_intent_data: {
      metadata: { userId, kind: "credits", packId, purchaseId: purchase.id },
    },
  });

  const amount = session.amount_total ?? 0;
  const currency = session.currency ?? "inr";

  await prisma.creditPurchase.update({
    where: { id: purchase.id },
    data: {
      orderId: session.id,
      amount,
      currency,
    },
  });

  return NextResponse.json({
    url: session.url,
    purchase_id: purchase.id,
    payment_order_id: session.id,
    amount,
    currency,
  });
}
