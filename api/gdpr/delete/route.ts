import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "soft";

  if (mode === "soft") {
    await Promise.all([
      (supabase.from("items") as any).update({ status: "archived" }).eq("user_id", user.id),
      (supabase.from("workstreams") as any).update({ active: false }).eq("user_id", user.id),
    ]);
    return NextResponse.json({ ok: true, mode: "soft" });
  }

  await Promise.all([
    (supabase.from("xp_events") as any).delete().eq("user_id", user.id),
    (supabase.from("items") as any).delete().eq("user_id", user.id),
    (supabase.from("workstreams") as any).delete().eq("user_id", user.id),
    (supabase.from("life_areas") as any).delete().eq("user_id", user.id),
    (supabase.from("settings") as any).delete().eq("user_id", user.id),
    (supabase.from("calendar_credentials") as any).delete().eq("user_id", user.id),
    (supabase.from("coach_configs") as any).delete().eq("user_id", user.id),
    (supabase.from("billing_profiles") as any).delete().eq("user_id", user.id),
  ]);

  return NextResponse.json({ ok: true, mode: "hard" });
}

