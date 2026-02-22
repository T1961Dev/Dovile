import { NextResponse } from "next/server";
import { z } from "zod";

import { decomposeProject } from "@/lib/ai";
import { checkItemQuota, checkDailyCapacity } from "@/lib/stripe";
import { getTodayISO } from "@/lib/dates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  prompt: z.string().min(1),
  lifeAreaId: z.string().uuid(),
  workstreamId: z.string().uuid().optional().nullable(),
  confirm: z.boolean().optional().default(false),
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
  const payload = schema.safeParse(json);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  const breakdown = await decomposeProject(payload.data.prompt);

  if (!payload.data.confirm) {
    return NextResponse.json({ preview: (breakdown.tasks ?? []) as DecomposedTask[] });
  }

  if (!breakdown.tasks?.length) {
    return NextResponse.json({ error: "No tasks generated" }, { status: 400 });
  }

  const quotaOk = await checkItemQuota(user.id);
  if (!quotaOk) {
    return NextResponse.json(
      { error: "You've reached your plan's item limit. Upgrade to add more.", code: "quota_exceeded" },
      { status: 402 },
    );
  }

  const settings = await (supabase.from("settings").select("timezone") as any)
    .eq("user_id", user.id).maybeSingle();
  const timezone = settings.data?.timezone ?? "Europe/London";
  const today = getTodayISO(timezone);

  const capacityCheck = await checkDailyCapacity(user.id, today);
  const taskCount = (breakdown.tasks as DecomposedTask[]).length;
  if (capacityCheck.used + taskCount > capacityCheck.limit) {
    return NextResponse.json(
      {
        error: `Adding ${taskCount} tasks would exceed your daily capacity (${capacityCheck.used}/${capacityCheck.limit}). Reduce the number of tasks or upgrade your plan.`,
        code: "capacity_exceeded",
        used: capacityCheck.used,
        limit: capacityCheck.limit,
      },
      { status: 409 },
    );
  }

  const inserts = (breakdown.tasks as DecomposedTask[]).map((task) => ({
    user_id: user.id,
    life_area_id: payload.data.lifeAreaId,
    workstream_id: payload.data.workstreamId ?? null,
    title: task.title || "Untitled Task",
    notes: task.notes ?? null,
    type: "task",
    status: "pending",
    scheduled_for: today,
  }));

  const { data, error } = await (supabase
    .from("items") as any)
    .insert(inserts)
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}

type DecomposedTask = {
  title: string;
  notes?: string | null;
};
