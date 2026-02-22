import { NextResponse } from "next/server";
import { z } from "zod";

import { assertStripe, ensureCustomer } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  priceId: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "priceId is required" }, { status: 400 });
  }

  const stripe = assertStripe();
  const profile = await ensureCustomer(user.id, user.email);

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: profile.customer_id!,
    line_items: [{ price: parsed.data.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    success_url: `${origin}/settings?billing=success`,
    cancel_url: `${origin}/settings`,
    metadata: { supabase_user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
