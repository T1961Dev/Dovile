"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_XP_PER_TASK } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];
type ItemInsert = Database["public"]["Tables"]["items"]["Insert"];
type ItemUpdate = Database["public"]["Tables"]["items"]["Update"];

export async function createItemAction(payload: ItemInsert): Promise<ItemRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await (supabase as any)
    .from("items")
    .insert({
      ...payload,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create item");
  }

  revalidatePath("/app");
  return data as ItemRow;
}

export async function updateItemAction(id: string, payload: ItemUpdate): Promise<ItemRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Check if we're marking a task as done (need to check current status first)
  let shouldAwardXp = false;
  if (payload.status === "done") {
    const { data: currentItem } = await (supabase
      .from("items")
      .select("status, type") as any)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    
    // Only award XP if it wasn't already done and it's a task
    shouldAwardXp = currentItem?.status !== "done" && currentItem?.type === "task";
  }

  const { data, error } = await (supabase as any)
    .from("items")
    .update({
      ...payload,
      // Set completed_at timestamp when marking as done
      ...(payload.status === "done" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update item");
  }

  // Award XP if task was just completed
  if (shouldAwardXp) {
    const xpEvent = await (supabase.from("xp_events") as any).insert({
      user_id: user.id,
      item_id: id,
      kind: "task_complete",
      amount: DEFAULT_XP_PER_TASK,
      meta: {
        source: "server_action",
      },
    });
    if (xpEvent.error) {
      console.error("Failed to log XP event", xpEvent.error);
    }
  }

  revalidatePath("/app");
  return data as ItemRow;
}

export async function completeItemAction(id: string): Promise<ItemRow> {
  return updateItemAction(id, { status: "done" });
}

export async function startTaskAction(id: string): Promise<ItemRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // First, set all other in_progress tasks to pending
  await (supabase
    .from("items") as any)
    .update({ status: "pending" })
    .eq("user_id", user.id)
    .eq("type", "task")
    .eq("status", "in_progress");

  // Then set this task to in_progress
  return updateItemAction(id, { status: "in_progress" });
}

export async function convertIdeaToTaskAction(
  id: string,
  overrides: ItemUpdate = {},
): Promise<ItemRow> {
  return updateItemAction(id, {
    type: "task",
    status: "pending",
    ...overrides,
  });
}

export async function archiveIdeaAction(id: string, reason?: string): Promise<ItemRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await (supabase as any)
    .from("items")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to archive idea");
  }

  await (supabase.from("idea_archive") as any).insert({
    idea_id: id,
    reason: reason ?? null,
  });

  revalidatePath("/app");
  return data as ItemRow;
}

export async function restoreIdeaAction(id: string): Promise<ItemRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await (supabase as any)
    .from("items")
    .update({ status: "pending" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to restore idea");
  }

  await (supabase.from("idea_archive") as any).delete().eq("idea_id", id);

  revalidatePath("/app");
  return data as ItemRow;
}

export async function deleteItemAction(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await (supabase.from("items") as any).delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
}

export async function getItemAction(id: string): Promise<ItemRow | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await (supabase
    .from("items")
    .select("*") as any)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ItemRow | null;
}


