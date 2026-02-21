import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_DAILY_CAPACITY } from "@/lib/constants";
import { getTodayISO } from "@/lib/dates";
import { checkItemQuota } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createItemSchema = z.object({
  lifeAreaId: z.string().uuid(),
  title: z.string().min(1),
  notes: z.string().optional(),
  workstreamId: z.string().uuid().optional().nullable(),
  type: z.enum(["task", "idea"]),
  scheduledFor: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = createItemSchema.safeParse(json);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  const quotaOk = await checkItemQuota(user.id);
  if (!quotaOk) {
    return NextResponse.json(
      {
        error: "Free tier exceeded",
        code: "quota_exceeded",
      },
      { status: 402 },
    );
  }

  const settings = await (supabase
    .from("settings")
    .select("*") as any)
    .eq("user_id", user.id)
    .maybeSingle();

  const timezone = settings.data?.timezone ?? "Europe/London";
  const capacity = settings.data?.daily_capacity ?? DEFAULT_DAILY_CAPACITY;

  const targetDate = payload.data.scheduledFor ?? getTodayISO(timezone);

  if (payload.data.type === "task") {
    const { count } = await (supabase
      .from("items")
      .select("id", { count: "exact", head: true }) as any)
      .eq("user_id", user.id)
      .eq("type", "task")
      .eq("status", "pending")
      .or(`scheduled_for.eq.${targetDate},and(scheduled_for.is.null,due_date.eq.${targetDate})`);

    if ((count ?? 0) >= capacity) {
      return NextResponse.json(
        {
          error: "Daily capacity exceeded",
          code: "capacity_exceeded",
          suggestions: ["tomorrow", "this weekend", "next week"],
        },
        { status: 409 },
      );
    }
  }

  const { data, error } = await (supabase
    .from("items") as any)
    .insert({
      user_id: user.id,
      life_area_id: payload.data.lifeAreaId,
      workstream_id: payload.data.workstreamId ?? null,
      title: payload.data.title,
      notes: payload.data.notes ?? null,
      type: payload.data.type,
      scheduled_for: payload.data.type === "task" ? targetDate : null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

