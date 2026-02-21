import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { assertStripe, markSubscriptionActive } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = assertStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = (await headers()).get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature!, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.supabase_user_id;
    if (userId) {
      await markSubscriptionActive(
        userId,
        subscription.items.data[0]?.price.id ?? "",
        subscription.status,
      );
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.supabase_user_id;
    if (userId) {
      await markSubscriptionActive(userId, subscription.items.data[0]?.price.id ?? "", "free");
    }
  }

  return NextResponse.json({ received: true });
}

