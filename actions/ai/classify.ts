"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DEFAULT_DAILY_CAPACITY } from "@/lib/constants";
import { getTodayISO } from "@/lib/dates";
import { classifyUtterance } from "@/lib/ai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];

const inputSchema = z.object({
  userId: z.string().uuid(),
  text: z.string().min(1),
  timezone: z.string().optional(),
  dailyCapacity: z.number().min(0).max(99).optional(),
});

type ClassifyResult = {
  reply: string;
  createdItem: ItemRow | null;
  classification: Record<string, unknown>;
  exceededCapacity?: boolean;
};

export async function classifyCaptureAction(rawInput: unknown): Promise<ClassifyResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (parsed.data.userId !== user.id) {
    throw new Error("User mismatch");
  }

  const userId = user.id;

  const { data: areasData, error: areasError } = await (supabase
    .from("life_areas")
    .select("*") as any)
    .eq("user_id", userId);

  type LifeAreaRow = Database["public"]["Tables"]["life_areas"]["Row"];
  const areasDataTyped = (areasData ?? []) as LifeAreaRow[];
  const areas = areasDataTyped.sort((a: LifeAreaRow, b: LifeAreaRow) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });

  if (areasError) {
    throw new Error(areasError.message);
  }

  if (!areas || areas.length === 0) {
    throw new Error("Life areas not configured yet.");
  }

  const coachConfig = await (supabase
    .from("coach_configs")
    .select("*") as any)
    .eq("user_id", userId)
    .maybeSingle();

  // Fetch workstreams with descriptions for AI context
  const { data: workstreamsData } = await (supabase
    .from("workstreams")
    .select("id, title, description, life_area_id") as any)
    .eq("user_id", userId)
    .eq("active", true);

  // Get recent task examples for each workstream to help AI learn
  const workstreamsWithContext = await Promise.all(
    (workstreamsData ?? []).map(async (ws: { id: string; title: string; description: string | null; life_area_id: string }) => {
      const { data: recentTasks } = await (supabase
        .from("items")
        .select("title") as any)
        .eq("user_id", userId)
        .eq("workstream_id", ws.id)
        .eq("type", "task")
        .order("created_at", { ascending: false })
        .limit(5);

      const area = areas.find((a: LifeAreaRow) => a.id === ws.life_area_id);
      return {
        title: ws.title,
        description: ws.description,
        lifeArea: area?.name ?? "Unknown",
        taskExamples: (recentTasks ?? []).map((t: { title: string }) => t.title),
      };
    })
  );

  const classification = await classifyUtterance(parsed.data.text, {
    model: coachConfig.data?.model ?? undefined,
    dailyCapacity: parsed.data.dailyCapacity ?? DEFAULT_DAILY_CAPACITY,
    workstreams: workstreamsWithContext,
  });

  const targetArea =
    areas.find(
      (area: LifeAreaRow) => area.name.toLowerCase() === String(classification.life_area ?? "").toLowerCase(),
    ) ?? areas[0]!;

  // Try to find matching workstream if workstream_hint is provided
  let workstreamId: string | null = null;
  const workstreamHint = classification.workstream_hint as string | null | undefined;
  if (workstreamHint) {
    const { data: workstreamsData } = await (supabase
      .from("workstreams")
      .select("id, title") as any)
      .eq("user_id", userId)
      .eq("life_area_id", targetArea.id)
      .eq("active", true);

    const workstreams = (workstreamsData ?? []) as Array<{ id: string; title: string }>;

    if (workstreams && workstreams.length > 0) {
      // Try to find a match (case-insensitive, partial match)
      const hintLower = workstreamHint.toLowerCase();
      const match = workstreams.find(
        (ws: { id: string; title: string }) => ws.title.toLowerCase().includes(hintLower) || hintLower.includes(ws.title.toLowerCase()),
      );
      if (match) {
        workstreamId = match.id;
      }
    }
  }

  const timezone = parsed.data.timezone ?? "Europe/London";
  const targetDate = getTodayISO(timezone);
  // In DUMP MODE, always create ideas (not tasks)
  const type = "idea";

  // Use improved_wording if provided, otherwise use summary
  const title = (classification.improved_wording as string | undefined) 
    ?? (classification.summary as string | undefined) 
    ?? parsed.data.text.slice(0, 60);

  // Store workstream_hint in notes if we couldn't match it to an existing workstream
  const notes = workstreamId ? null : (workstreamHint ?? null);

  const { data: createdItem, error } = await (supabase
    .from("items") as any)
    .insert({
      user_id: userId,
      life_area_id: targetArea.id,
      workstream_id: workstreamId,
      title,
      notes,
      type,
      scheduled_for: null, // Ideas don't get scheduled
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");

  // Get workstream name if assigned
  let workstreamName: string | null = null;
  if (workstreamId) {
    const { data: workstream } = await (supabase
      .from("workstreams")
      .select("title") as any)
      .eq("id", workstreamId)
      .single();
    workstreamName = workstream?.title ?? null;
  }

  const reply = buildCoachReply(targetArea.name, classification.actions ?? [], workstreamName);

  return {
    reply,
    createdItem: createdItem as ItemRow,
    classification,
  };
}

function buildCoachReply(areaName: string, actions: unknown, workstreamName?: string | null) {
  let intro = `Got it. I dropped this into ${areaName}`;
  if (workstreamName) {
    intro += ` → ${workstreamName}`;
  }
  intro += " as an IDEA.";
  
  if (!Array.isArray(actions) || actions.length === 0) {
    return `${intro} You can drag it to a project/process or convert it to a task later.`;
  }
  const extras = actions.map((action) => `• ${String(action)}`).join("\n");
  return `${intro}\n${extras}`;
}


