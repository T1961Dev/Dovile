import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const toggleSchema = z.object({
  date: z.string(),
});

type RouteParams = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify habit belongs to user
  const { data: habit } = await (supabase
    .from("habits")
    .select("id") as any)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  const json = await request.json();
  const payload = toggleSchema.safeParse(json);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  // Check if completion exists
  const { data: existing } = await (supabase
    .from("habit_completions")
    .select("id") as any)
    .eq("habit_id", params.id)
    .eq("completed_at", payload.data.date)
    .maybeSingle();

  if (existing) {
    // Delete completion
    await (supabase.from("habit_completions") as any).delete().eq("id", existing.id);
    return NextResponse.json({ completed: false });
  } else {
    // Create completion
    const { data, error } = await (supabase
      .from("habit_completions") as any)
      .insert({
        habit_id: params.id,
        completed_at: payload.data.date,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ completed: true, completion: data });
  }
}

