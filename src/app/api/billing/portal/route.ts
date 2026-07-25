import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
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
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing customer yet. Subscribe first." }, { status: 400 });
  }

  const base = config.stripe.appUrl || new URL(req.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${base}/billing`,
  });
  return NextResponse.json({ url: session.url });
}
