import { NextResponse } from "next/server";
import { z } from "zod";

import { getTodayISO } from "@/lib/dates";
import { checkItemQuota, checkDailyCapacity } from "@/lib/stripe";
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
      { error: "You've reached your plan's item limit. Upgrade to add more.", code: "quota_exceeded" },
      { status: 402 },
    );
  }

  const settings = await (supabase
    .from("settings")
    .select("*") as any)
    .eq("user_id", user.id)
    .maybeSingle();

  const timezone = settings.data?.timezone ?? "Europe/London";
  const targetDate = payload.data.scheduledFor ?? getTodayISO(timezone);

  if (payload.data.type === "task") {
    const capacityCheck = await checkDailyCapacity(user.id, targetDate);
    if (!capacityCheck.allowed) {
      return NextResponse.json(
        {
          error: `Daily capacity reached (${capacityCheck.used}/${capacityCheck.limit}). Upgrade your plan or adjust capacity in Settings.`,
          code: "capacity_exceeded",
          used: capacityCheck.used,
          limit: capacityCheck.limit,
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
