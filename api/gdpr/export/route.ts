import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [areas, workstreams, items, settings, xpEvents] = await Promise.all([
    (supabase.from("life_areas").select("*") as any).eq("user_id", user.id),
    (supabase.from("workstreams").select("*") as any).eq("user_id", user.id),
    (supabase.from("items").select("*") as any).eq("user_id", user.id),
    (supabase.from("settings").select("*") as any).eq("user_id", user.id).maybeSingle(),
    (supabase.from("xp_events").select("*") as any).eq("user_id", user.id),
  ]);

  const exportPayload = {
    user: {
      id: user.id,
      email: user.email,
    },
    generatedAt: new Date().toISOString(),
    lifeAreas: areas.data ?? [],
    workstreams: workstreams.data ?? [],
    items: items.data ?? [],
    settings: settings.data ?? null,
    xpEvents: xpEvents.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lifewheel-export-${user.id}.json"`,
    },
  });
}

