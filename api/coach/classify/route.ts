import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_DAILY_CAPACITY } from "@/lib/constants";
import { getTodayISO } from "@/lib/dates";
import { classifyUtterance } from "@/lib/ai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const schema = z.object({
  message: z.string().min(1),
  userId: z.string().uuid(),
  timezone: z.string().optional(),
  dailyCapacity: z.number().optional(),
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

  if (payload.data.userId !== user.id) {
    return NextResponse.json({ error: "User mismatch" }, { status: 403 });
  }

  const { data: areas, error: areasError } = await (supabase
    .from("life_areas")
    .select("*") as any)
    .eq("user_id", user.id);

  if (areasError || !areas || areas.length === 0) {
    return NextResponse.json({ error: "Life areas not configured" }, { status: 400 });
  }

  const coachConfig = await (supabase
    .from("coach_configs")
    .select("*") as any)
    .eq("user_id", user.id)
    .maybeSingle();

  const classification = await classifyUtterance(payload.data.message, {
    model: coachConfig.data?.model ?? undefined,
    dailyCapacity: payload.data.dailyCapacity ?? DEFAULT_DAILY_CAPACITY,
  });

  type LifeAreaRow = Database["public"]["Tables"]["life_areas"]["Row"];
  const areasTyped = (areas ?? []) as LifeAreaRow[];
  const targetArea =
    areasTyped.find(
      (area: LifeAreaRow) => area.name.toLowerCase() === String(classification.life_area ?? "").toLowerCase(),
    ) ?? areasTyped[0]!;

  const targetDate = getTodayISO(payload.data.timezone ?? "Europe/London");
  const type = classification.type === "task" ? "task" : "idea";

  if (type === "task") {
    const capacity = payload.data.dailyCapacity ?? DEFAULT_DAILY_CAPACITY;
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
          reply:
            "You're at capacity today. Let's consider deferring this. How about tomorrow, this weekend, or next week?",
          createdItem: null,
          exceededCapacity: true,
        },
        { status: 409 },
      );
    }
  }

  const { data: item, error } = await (supabase
    .from("items") as any)
    .insert({
      user_id: user.id,
      life_area_id: targetArea.id,
      title: classification.summary ?? payload.data.message.slice(0, 60),
      notes: classification.workstream_hint ?? null,
      type,
      scheduled_for: type === "task" ? targetDate : null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reply = buildCoachReply(targetArea.name, classification.actions ?? []);

  return NextResponse.json({
    reply,
    createdItem: item,
    classification,
  });
}

function buildCoachReply(areaName: string, actions: string[]) {
  const intro = `Got it. I've parked this under ${areaName}.`;
  if (!actions.length) {
    return `${intro} Let me know when you'd like to schedule it.`;
  }
  const extras = actions.map((action) => `• ${action}`).join("\n");
  return `${intro}\n${extras}`;
}

