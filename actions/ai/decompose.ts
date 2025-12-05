"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { decomposeProject } from "@/lib/ai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type VisionRow = Database["public"]["Tables"]["visions"]["Row"];
type VisionStepRow = Database["public"]["Tables"]["vision_steps"]["Row"];

const decomposeInputSchema = z.object({
  title: z.string().min(3),
  timeframe: z.string().min(1),
  description: z.string().min(10),
  lifeAreaId: z.string().uuid().optional(),
  targetDate: z.string().optional(),
});

export type DecomposeVisionResult = {
  vision: VisionRow;
  steps: VisionStepRow[];
};

export async function decomposeVisionAction(rawInput: unknown): Promise<DecomposeVisionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const parsed = decomposeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { data: vision, error: visionError } = await (supabase
    .from("visions") as any)
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      timeframe: parsed.data.timeframe,
      description: parsed.data.description,
      target_date: parsed.data.targetDate ?? null,
      status: "draft",
    })
    .select("*")
    .single();

  if (visionError || !vision) {
    throw new Error(visionError?.message ?? "Unable to create vision");
  }

  const aiResult = await decomposeProject(parsed.data.description);
  const tasks = Array.isArray(aiResult?.tasks) ? aiResult.tasks : [];

  if (tasks.length === 0) {
    return {
      vision: vision as VisionRow,
      steps: [],
    };
  }

  const stepPayloads = tasks.map((task: any) => ({
    vision_id: vision.id,
    bubble_type: "task",
    bubble_payload: {
      title: String(task.improved_wording ?? task.title ?? task.name ?? "Task"),
      notes: task.notes ?? task.description ?? null,
      life_area_id: parsed.data.lifeAreaId ?? null,
      type: "task",
      definition_of_done: task.notes?.includes("Definition of Done:") 
        ? task.notes 
        : (task.notes ?? null),
    },
  }));

  const { data: steps, error: stepError } = await (supabase
    .from("vision_steps") as any)
    .insert(stepPayloads)
    .select("*");

  if (stepError) {
    throw new Error(stepError.message);
  }

  revalidatePath("/app");

  return {
    vision: vision as VisionRow,
    steps: (steps ?? []) as VisionStepRow[],
  };
}


