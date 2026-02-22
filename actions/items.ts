"use server";

import { DEFAULT_XP_PER_TASK } from "@/lib/constants";
import { getTodayISO } from "@/lib/dates";
import { getSettings } from "@/lib/queries";
import { checkItemQuota, checkDailyCapacity } from "@/lib/stripe";
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

  const quotaOk = await checkItemQuota(user.id);
  if (!quotaOk) {
    throw new Error("You've reached your plan's item limit. Upgrade to add more.");
  }

  const settings = await getSettings(supabase);
  const timezone = settings?.timezone ?? "Europe/London";

  if (payload.type === "task" && !payload.scheduled_for) {
    payload.scheduled_for = getTodayISO(timezone);
  }

  if (payload.type === "task" && payload.scheduled_for) {
    const capacityCheck = await checkDailyCapacity(user.id, payload.scheduled_for);
    if (!capacityCheck.allowed) {
      throw new Error(`Daily capacity reached (${capacityCheck.used}/${capacityCheck.limit}). Upgrade your plan or adjust your capacity in Settings.`);
    }
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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: item } = await (supabase
    .from("items")
    .select("type") as any)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!item || item.type !== "idea") {
    throw new Error("Item is not an idea");
  }

  const settings = await getSettings(supabase);
  const timezone = settings?.timezone ?? "Europe/London";
  const targetDate = overrides.scheduled_for ?? getTodayISO(timezone);

  const { allowed, used, limit } = await checkDailyCapacity(user.id, targetDate);
  if (!allowed) {
    throw new Error(`Daily capacity reached (${used}/${limit}). Upgrade your plan or adjust your capacity in Settings.`);
  }

  return updateItemAction(id, {
    type: "task",
    status: "pending",
    scheduled_for: targetDate,
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

export async function getArchivedIdeasAction(lifeAreaId?: string): Promise<ItemRow[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  let query = (supabase
    .from("items")
    .select("*") as any)
    .eq("user_id", user.id)
    .eq("type", "idea")
    .eq("status", "archived")
    .order("created_at", { ascending: false });
  
  if (lifeAreaId) {
    query = query.eq("life_area_id", lifeAreaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ItemRow[];
}


