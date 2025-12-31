import "server-only";
import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { Item, LifeArea, Workstream } from "@/types/entities";

export const getServerSupabaseClient = cache(async () => await createServerSupabaseClient());

export async function getLifeAreas(client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const { data, error } = await supabase
    .from("life_areas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function getWorkstreams(client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const { data, error } = await supabase
    .from("workstreams")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function getSettings(client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  // RLS will automatically filter by auth.uid()
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { user_id: string; daily_capacity: number; timezone: string; calendar_provider: string; default_resource_blocks?: any } | null;
}

export async function getTodayTasks(dateIso: string, client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const today = new Date().toISOString().slice(0, 10);
  const isPastDate = dateIso < today;
  const isToday = dateIso === today;
  const isFutureDate = dateIso > today;
  
  // For past dates: include done tasks
  // For today: include pending and in_progress
  // For future dates: include pending and in_progress
  const statusFilter = isPastDate 
    ? ["pending", "in_progress", "done"]
    : ["pending", "in_progress"];
  
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("type", "task")
    .in("status", statusFilter)
    .neq("status", "archived")
    .or(`scheduled_for.eq.${dateIso},and(scheduled_for.is.null,due_date.eq.${dateIso})`)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function getAllTasks(client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("type", "task")
    .in("status", ["pending", "in_progress", "done"])
    .neq("status", "archived")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function getIdeas(client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("type", "idea")
    .neq("status", "archived")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function getArchivedIdeas(lifeAreaId?: string, client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  let query = supabase
    .from("items")
    .select("*")
    .eq("type", "idea")
    .eq("status", "archived")
    .order("created_at", { ascending: false });
  
  if (lifeAreaId) {
    query = query.eq("life_area_id", lifeAreaId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getResourceBlocks(client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const { data, error } = await supabase
    .from("resource_blocks")
    .select("*")
    .eq("active", true)
    .order("start_hour", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getHabits(client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getHabitCompletions(date: string, client?: TypedSupabaseClient) {
  const supabase = client ?? (await getServerSupabaseClient());
  const { data, error } = await supabase
    .from("habit_completions")
    .select("habit_id, completed_at")
    .eq("completed_at", date);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export type DashboardData = {
  areas: LifeArea[];
  workstreams: Workstream[];
  todayTasks: Item[];
  allTasks: Item[];
  ideas: Item[];
  totalItemCount: number;
};

export async function getDashboardData(dateIso: string): Promise<DashboardData> {
  const supabase = await getServerSupabaseClient();
  const [areas, workstreams, todayTasks, ideas, totalItems, allTasks] = await Promise.all([
    getLifeAreas(supabase),
    getWorkstreams(supabase),
    getTodayTasks(dateIso, supabase),
    getIdeas(supabase),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true }),
    getAllTasks(supabase),
  ]);

  const totalItemCount = totalItems?.count ?? 0;

  return {
    areas: (areas ?? []) as LifeArea[],
    workstreams: (workstreams ?? []) as Workstream[],
    todayTasks: (todayTasks ?? []) as Item[],
    allTasks: (allTasks ?? []) as Item[],
    ideas: (ideas ?? []) as Item[],
    totalItemCount,
  };
}

