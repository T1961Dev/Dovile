import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { assertStripe, markSubscriptionActive, logPaymentEvent } from "@/lib/stripe";

export const runtime = "nodejs";

async function resolveUserId(stripe: Stripe, subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.supabase_user_id) {
    return subscription.metadata.supabase_user_id;
  }
  try {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.metadata?.supabase_user_id) {
      return customer.metadata.supabase_user_id;
    }
  } catch (err) {
    console.error("Failed to resolve user from customer", err);
  }
  return null;
}

function toIso(ts: number | null | undefined): string | undefined {
  if (!ts) return undefined;
  return new Date(ts * 1000).toISOString();
}

async function syncSubscription(stripe: Stripe, subscription: Stripe.Subscription, userId: string) {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id ?? "";
  const status = subscription.status === "active" || subscription.status === "trialing"
    ? "active"
    : subscription.status === "canceled" || subscription.status === "unpaid"
      ? "free"
      : subscription.status;

  const periodStart = (firstItem as any)?.current_period_start as number | undefined;
  const periodEnd = (firstItem as any)?.current_period_end as number | undefined;

  let paymentMethodType: string | undefined;
  let paymentMethodLast4: string | undefined;
  try {
    const pmId = typeof subscription.default_payment_method === "string"
      ? subscription.default_payment_method
      : subscription.default_payment_method?.id;
    if (pmId) {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      paymentMethodType = pm.type;
      if (pm.card) paymentMethodLast4 = pm.card.last4;
    }
  } catch { /* ignore */ }

  await markSubscriptionActive(userId, priceId, status, {
    subscription_id: subscription.id,
    current_period_start: toIso(periodStart),
    current_period_end: toIso(periodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end: toIso((subscription as any).trial_end),
    payment_method_type: paymentMethodType,
    payment_method_last4: paymentMethodLast4,
  });
}

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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && session.metadata?.supabase_user_id) {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(stripe, sub, session.metadata.supabase_user_id);
          await logPaymentEvent(session.metadata.supabase_user_id, "checkout.session.completed", event.id, {
            amount_cents: session.amount_total ?? undefined,
            currency: session.currency ?? "usd",
            metadata: { subscription_id: subscriptionId },
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(stripe, subscription);
        if (userId) {
          await syncSubscription(stripe, subscription, userId);
          await logPaymentEvent(userId, event.type, event.id, {
            metadata: { subscription_id: subscription.id, status: subscription.status },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(stripe, subscription);
        if (userId) {
          await markSubscriptionActive(userId, "", "free", {
            subscription_id: subscription.id,
            cancel_at_period_end: false,
          });
          await logPaymentEvent(userId, "customer.subscription.deleted", event.id, {
            metadata: { subscription_id: subscription.id },
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (!customer.deleted && customer.metadata?.supabase_user_id) {
              await logPaymentEvent(customer.metadata.supabase_user_id, "invoice.paid", event.id, {
                amount_cents: invoice.amount_paid,
                currency: invoice.currency,
              });
            }
          } catch { /* ignore */ }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (!customer.deleted && customer.metadata?.supabase_user_id) {
              await logPaymentEvent(customer.metadata.supabase_user_id, "invoice.payment_failed", event.id, {
                amount_cents: invoice.amount_due,
                currency: invoice.currency,
                status: "failed",
              });
            }
          } catch { /* ignore */ }
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
