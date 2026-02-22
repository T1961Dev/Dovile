import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  daily_capacity: z.number().int().min(1).max(24).optional(),
  timezone: z.string().optional(),
  calendar_provider: z.string().nullable().optional(),
  accepted_terms_at: z.string().optional(),
  accepted_privacy_at: z.string().optional(),
  onboarding_completed_at: z.string().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = schema.safeParse(json);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (payload.data.daily_capacity != null) updates.daily_capacity = payload.data.daily_capacity;
  if (payload.data.timezone != null) updates.timezone = payload.data.timezone;
  if (payload.data.calendar_provider !== undefined) updates.calendar_provider = payload.data.calendar_provider;
  if (payload.data.accepted_terms_at != null) updates.accepted_terms_at = payload.data.accepted_terms_at;
  if (payload.data.accepted_privacy_at != null) updates.accepted_privacy_at = payload.data.accepted_privacy_at;
  if (payload.data.onboarding_completed_at != null) updates.onboarding_completed_at = payload.data.onboarding_completed_at;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: existing } = await (supabase
    .from("settings") as any)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await (supabase
      .from("settings") as any)
      .update(updates)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await (supabase
      .from("settings") as any)
      .insert({
        user_id: user.id,
        daily_capacity: updates.daily_capacity ?? 6,
        timezone: updates.timezone ?? "Europe/London",
        calendar_provider: updates.calendar_provider ?? "google",
        accepted_terms_at: updates.accepted_terms_at ?? null,
        accepted_privacy_at: updates.accepted_privacy_at ?? null,
        onboarding_completed_at: updates.onboarding_completed_at ?? null,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/app");
  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}
