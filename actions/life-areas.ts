"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type LifeAreaRow = Database["public"]["Tables"]["life_areas"]["Row"];
type LifeAreaInsert = Database["public"]["Tables"]["life_areas"]["Insert"];
type LifeAreaUpdate = Database["public"]["Tables"]["life_areas"]["Update"];
type LifeAreaRatingRow = Database["public"]["Tables"]["life_area_ratings"]["Row"];

export async function createLifeAreaAction(payload: LifeAreaInsert): Promise<LifeAreaRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data, error } = await (supabase as any)
    .from("life_areas")
    .insert({
      ...payload,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create life area");
  }

  revalidatePath("/app");
  return data as LifeAreaRow;
}

export async function updateLifeAreaAction(id: string, payload: LifeAreaUpdate): Promise<LifeAreaRow> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data, error } = await (supabase as any)
    .from("life_areas")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update life area");
  }

  revalidatePath("/app");
  return data as LifeAreaRow;
}

export async function deleteLifeAreaAction(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { error } = await (supabase
    .from("life_areas") as any)
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app");
}

export async function rateLifeAreaAction(lifeAreaId: string, rating: number, note?: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { error } = await (supabase.from("life_area_ratings") as any).insert({
    life_area_id: lifeAreaId,
    rating,
    note: note ?? null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/app");
}

export async function getLifeAreaRatingsAction(
  areaIds: string[],
): Promise<Record<string, LifeAreaRatingRow[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");
  if (!areaIds.length) return {};

  const { data, error } = await (supabase
    .from("life_area_ratings")
    .select("*") as any)
    .in("life_area_id", areaIds)
    .order("noted_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  const grouped: Record<string, LifeAreaRatingRow[]> = {};
  ((data ?? []) as LifeAreaRatingRow[]).forEach((entry: LifeAreaRatingRow) => {
    if (!grouped[entry.life_area_id]) {
      grouped[entry.life_area_id] = [];
    }
    grouped[entry.life_area_id]!.push(entry);
  });

  return grouped;
}


