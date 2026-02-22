"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type WorkstreamRow = Database["public"]["Tables"]["workstreams"]["Row"];
type WorkstreamInsert = Database["public"]["Tables"]["workstreams"]["Insert"];
type WorkstreamUpdate = Database["public"]["Tables"]["workstreams"]["Update"];

const payloadSchema = z.object({
  lifeAreaId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(["project", "process", "habit"]),
});

export async function createWorkstreamAction(input: unknown): Promise<WorkstreamRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to create a workstream.");
  }

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid data");
  }

  const insertPayload: WorkstreamInsert = {
    user_id: user.id,
    life_area_id: parsed.data.lifeAreaId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    kind: parsed.data.kind,
  };

  const { data, error } = await (supabase as any)
    .from("workstreams")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create workstream");
  }

  return data as unknown as WorkstreamRow;
}

export async function updateWorkstreamAction(
  id: string,
  payload: WorkstreamUpdate,
): Promise<WorkstreamRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to update a workstream.");
  }

  const { data, error } = await (supabase as any)
    .from("workstreams")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update workstream");
  }

  return data as unknown as WorkstreamRow;
}

export async function deleteWorkstreamAction(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to delete a workstream.");
  }

  const { error } = await (supabase as any)
    .from("workstreams")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function archiveWorkstreamAction(id: string): Promise<WorkstreamRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await (supabase as any)
    .from("workstreams")
    .update({ active: false })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to archive workstream");
  }

  return data as unknown as WorkstreamRow;
}

export async function restoreWorkstreamAction(id: string): Promise<WorkstreamRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await (supabase as any)
    .from("workstreams")
    .update({ active: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to restore workstream");
  }

  return data as unknown as WorkstreamRow;
}
