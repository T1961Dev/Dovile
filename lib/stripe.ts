import Stripe from "stripe";

import {
  MAX_FREE_ITEMS,
  MAX_BASIC_ITEMS,
  STRIPE_PRICES,
  MAX_FREE_DAILY_CAPACITY,
  MAX_BASIC_DAILY_CAPACITY,
  MAX_PRO_DAILY_CAPACITY,
} from "@/lib/constants";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2025-10-29.clover" as any,
    })
  : null;

export function assertStripe() {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }
  return stripe;
}

type BillingProfileRow = Database["public"]["Tables"]["billing_profiles"]["Row"];

export async function ensureCustomer(userId: string, email?: string | null): Promise<BillingProfileRow> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: profile } = await (supabase
    .from("billing_profiles")
    .select("*") as any)
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.customer_id) {
    return profile;
  }

  const stripeClient = assertStripe();
  const customer = await stripeClient.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  const { data: upserted, error } = await (supabase
    .from("billing_profiles") as any)
    .upsert(
      {
        user_id: userId,
        customer_id: customer.id,
        subscription_status: "free",
      },
      { onConflict: "user_id" },
    )
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return upserted!;
}

export async function createPortalSession(userId: string, returnUrl: string, email?: string | null) {
  const profile = await ensureCustomer(userId, email);
  const stripeClient = assertStripe();
  const session = await stripeClient.billingPortal.sessions.create({
    customer: profile.customer_id!,
    return_url: returnUrl,
  });
  return session;
}

export function getDailyCapacityLimit(priceId: string | null, status: string): number {
  if (status === "free" || !status) return MAX_FREE_DAILY_CAPACITY;
  if (!priceId) return MAX_FREE_DAILY_CAPACITY;
  if (priceId === STRIPE_PRICES.basic) return MAX_BASIC_DAILY_CAPACITY;
  return MAX_PRO_DAILY_CAPACITY;
}

export function getEffectiveDailyCapacity(
  userCapacity: number,
  priceId: string | null,
  subscriptionStatus: string,
): number {
  const planMax = getDailyCapacityLimit(priceId, subscriptionStatus);
  return Math.min(userCapacity, planMax);
}

export async function checkDailyCapacity(
  userId: string,
  targetDate: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: settingsRow }, { data: billingRow }, { count }] = await Promise.all([
    (supabase.from("settings").select("*") as any).eq("user_id", userId).maybeSingle(),
    (supabase.from("billing_profiles").select("*") as any).eq("user_id", userId).maybeSingle(),
    (supabase.from("items").select("id", { count: "exact", head: true }) as any)
      .eq("user_id", userId)
      .eq("type", "task")
      .in("status", ["pending", "in_progress"])
      .or(`scheduled_for.eq.${targetDate},and(scheduled_for.is.null,due_date.eq.${targetDate}),and(scheduled_for.is.null,due_date.is.null)`),
  ]);

  const userCapacity = settingsRow?.daily_capacity ?? MAX_FREE_DAILY_CAPACITY;
  const billingStatus = billingRow?.subscription_status ?? "free";
  const priceId = billingRow?.price_id ?? null;
  const limit = getEffectiveDailyCapacity(userCapacity, priceId, billingStatus);
  const used = count ?? 0;

  return { allowed: used < limit, used, limit };
}

export function getItemLimit(priceId: string | null, status: string): number | null {
  if (status === "free" || !status) return MAX_FREE_ITEMS;
  if (!priceId) return MAX_FREE_ITEMS;
  if (priceId === STRIPE_PRICES.basic) return MAX_BASIC_ITEMS;
  return null; // Pro / Pro+ = unlimited
}

export async function checkItemQuota(userId: string) {
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: profile }, { count }] = await Promise.all([
    (supabase
      .from("billing_profiles")
      .select("*") as any)
      .eq("user_id", userId)
      .maybeSingle(),
    (supabase
      .from("items")
      .select("id", { count: "exact", head: true }) as any)
      .eq("user_id", userId),
  ]);

  const status = profile?.subscription_status ?? "free";
  const priceId = profile?.price_id ?? null;
  const totalItems = count ?? 0;
  const limit = getItemLimit(priceId, status);

  if (limit !== null && totalItems >= limit) {
    return false;
  }

  return true;
}

export async function markSubscriptionActive(
  userId: string,
  priceId: string,
  status: string,
  extra?: {
    subscription_id?: string;
    plan_name?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    trial_end?: string | null;
    payment_method_type?: string;
    payment_method_last4?: string;
  },
) {
  const supabase = createServiceRoleSupabaseClient();

  const planName = extra?.plan_name
    ?? (priceId === STRIPE_PRICES.proplus ? "proplus"
      : priceId === STRIPE_PRICES.pro ? "pro"
      : priceId === STRIPE_PRICES.basic ? "basic"
      : status === "free" ? "free" : "unknown");

  const { error } = await (supabase
    .from("billing_profiles") as any)
    .upsert(
      {
        user_id: userId,
        subscription_status: status,
        price_id: priceId,
        plan_name: planName,
        subscription_id: extra?.subscription_id ?? null,
        current_period_start: extra?.current_period_start ?? null,
        current_period_end: extra?.current_period_end ?? null,
        cancel_at_period_end: extra?.cancel_at_period_end ?? false,
        trial_end: extra?.trial_end ?? null,
        payment_method_type: extra?.payment_method_type ?? null,
        payment_method_last4: extra?.payment_method_last4 ?? null,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    throw error;
  }
}

export async function logPaymentEvent(
  userId: string,
  eventType: string,
  stripeEventId?: string,
  extra?: { amount_cents?: number; currency?: string; status?: string; metadata?: Record<string, unknown> },
) {
  const supabase = createServiceRoleSupabaseClient();
  await (supabase.from("payment_events") as any).insert({
    user_id: userId,
    event_type: eventType,
    stripe_event_id: stripeEventId ?? null,
    amount_cents: extra?.amount_cents ?? null,
    currency: extra?.currency ?? "usd",
    status: extra?.status ?? "succeeded",
    metadata: extra?.metadata ?? {},
  });
}

