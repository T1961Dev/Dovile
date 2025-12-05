import Stripe from "stripe";

import { MAX_FREE_ITEMS } from "@/lib/constants";
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
  const totalItems = count ?? 0;

  if (status === "free" && totalItems >= MAX_FREE_ITEMS) {
    return false;
  }

  return true;
}

export async function markSubscriptionActive(userId: string, priceId: string, status: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await (supabase
    .from("billing_profiles") as any)
    .upsert(
      {
        user_id: userId,
        subscription_status: status,
        price_id: priceId,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    throw error;
  }
}

