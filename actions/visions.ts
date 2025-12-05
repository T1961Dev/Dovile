"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type VisionRow = Database["public"]["Tables"]["visions"]["Row"];
type VisionStepRow = Database["public"]["Tables"]["vision_steps"]["Row"];
type ItemRow = Database["public"]["Tables"]["items"]["Row"];
type WorkstreamRow = Database["public"]["Tables"]["workstreams"]["Row"];

const createVisionSchema = z.object({
  title: z.string().min(3),
  timeframe: z.string().min(1),
  description: z.string().optional(),
  aiSummary: z.string().optional(),
  targetDate: z.string().optional(),
});

export async function createVisionAction(raw: unknown): Promise<VisionRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const parsed = createVisionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid vision input");
  }

  const { data, error } = await (supabase
    .from("visions") as any)
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      timeframe: parsed.data.timeframe,
      description: parsed.data.description ?? null,
      ai_summary: parsed.data.aiSummary ?? null,
      target_date: parsed.data.targetDate ?? null,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create vision");
  }

  revalidatePath("/app");
  return data as VisionRow;
}

const approveStepsSchema = z.object({
  visionId: z.string().uuid(),
  steps: z
    .array(
      z.object({
        stepId: z.string().uuid(),
        lifeAreaId: z.string().uuid().optional(),
        workstreamId: z.string().uuid().optional(),
        bubbleType: z.enum(["idea", "task", "project", "process"]),
      }),
    )
    .min(1),
});

type ApproveResult = {
  createdItems: ItemRow[];
  createdWorkstreams: WorkstreamRow[];
  updatedSteps: VisionStepRow[];
};

export async function approveVisionStepsAction(raw: unknown): Promise<ApproveResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const parsed = approveStepsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid approval payload");
  }

  const { data: lifeAreas } = await (supabase
    .from("life_areas")
    .select("id") as any)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const fallbackLifeAreaId = lifeAreas?.[0]?.id;

  const { data: steps, error: fetchError } = await (supabase
    .from("vision_steps")
    .select("*") as any)
    .eq("vision_id", parsed.data.visionId)
    .in(
      "id",
      parsed.data.steps.map((step) => step.stepId),
    );

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const approvalLookup = new Map(parsed.data.steps.map((entry) => [entry.stepId, entry]));
  const createdItems: ItemRow[] = [];
  const createdWorkstreams: WorkstreamRow[] = [];
  const updatedSteps: VisionStepRow[] = [];

  for (const step of steps ?? []) {
    const assignment = approvalLookup.get(step.id);
    if (!assignment) continue;
    const payload = step.bubble_payload as Record<string, unknown>;

    if (assignment.bubbleType === "task" || assignment.bubbleType === "idea") {
      const resolvedLifeArea =
        assignment.lifeAreaId ??
        (payload.life_area_id as string | undefined) ??
        fallbackLifeAreaId;

      if (!resolvedLifeArea) {
        throw new Error("Plan needs at least one life area to attach tasks.");
      }

      const insertPayload = {
        user_id: user.id,
        life_area_id: resolvedLifeArea,
        workstream_id: assignment.workstreamId ?? (payload.workstream_id as string | undefined) ?? null,
        title: String(payload.title ?? "Untitled"),
        notes: (payload.notes as string | null) ?? null,
        type: assignment.bubbleType,
        status: "pending",
      };
      const { data: item, error: insertError } = await (supabase
        .from("items") as any)
        .insert(insertPayload)
        .select("*")
        .single();

      if (insertError || !item) {
        throw new Error(insertError?.message ?? "Unable to create item from step");
      }
      createdItems.push(item as ItemRow);
    }

    if (assignment.bubbleType === "project" || assignment.bubbleType === "process") {
      const resolvedLifeArea =
        assignment.lifeAreaId ??
        (payload.life_area_id as string | undefined) ??
        fallbackLifeAreaId;

      if (!resolvedLifeArea) {
        throw new Error("Plan needs a life area to attach this project.");
      }

      const insertPayload = {
        user_id: user.id,
        life_area_id: resolvedLifeArea,
        title: String(payload.title ?? "Untitled"),
        description: (payload.notes as string | null) ?? null,
        kind: assignment.bubbleType === "project" ? "project" : "process",
        active: true,
      };
      const { data: workstream, error: wsError } = await (supabase
        .from("workstreams") as any)
        .insert(insertPayload)
        .select("*")
        .single();

      if (wsError || !workstream) {
        throw new Error(wsError?.message ?? "Unable to create workstream from step");
      }
      createdWorkstreams.push(workstream as WorkstreamRow);
    }

    const { data: updatedStep, error: updateError } = await (supabase
      .from("vision_steps") as any)
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("id", step.id)
      .select("*")
      .single();

    if (updateError || !updatedStep) {
      throw new Error(updateError?.message ?? "Unable to mark step as approved");
    }

    updatedSteps.push(updatedStep as VisionStepRow);
  }

  await (supabase
    .from("visions") as any)
    .update({ status: "active" })
    .eq("id", parsed.data.visionId)
    .eq("user_id", user.id);

  revalidatePath("/app");

  return {
    createdItems,
    createdWorkstreams,
    updatedSteps,
  };
}

export async function archiveVisionAction(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await (supabase
    .from("visions") as any)
    .update({ status: "archived" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
}


