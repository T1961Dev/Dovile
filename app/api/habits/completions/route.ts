import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
  }

  // Get all completions for user's habits on this date
  const { data, error } = await (supabase
    .from("habit_completions")
    .select("*, habits!inner(user_id)") as any)
    .eq("habits.user_id", user.id)
    .eq("completed_at", date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    completions: data?.map((c: { habit_id: string; completed_at: string }) => ({
      habit_id: c.habit_id,
      completed_at: c.completed_at,
    })) ?? [],
  });
}

