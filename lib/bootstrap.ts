import { DEFAULT_DAILY_CAPACITY, DEFAULT_LIFE_AREAS } from "@/lib/constants";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/supabase";

export async function seedDefaultsForUser(userId: string, timezone = "Europe/London") {
  try {
    const supabase: TypedSupabaseClient = createServiceRoleSupabaseClient();

    const { data: settings } = await supabase
      .from("settings")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings) {
      await (supabase.from("settings") as any).insert({
        user_id: userId,
        daily_capacity: DEFAULT_DAILY_CAPACITY,
        timezone,
      });
    }

    const { data: existingAreas } = await supabase
      .from("life_areas")
      .select("name")
      .eq("user_id", userId);

    const names = new Set(existingAreas?.map((area: { name: string }) => area.name));

    const toInsert = DEFAULT_LIFE_AREAS.filter((name) => !names.has(name)).map(
      (name, index) => ({
        name,
        user_id: userId,
        color: LIFE_AREA_PALETTE[index % LIFE_AREA_PALETTE.length],
        rating: 5,
      }),
    );

    if (toInsert.length > 0) {
      await (supabase.from("life_areas") as any).insert(toInsert);
    }

    const { data: coachConfig } = await supabase
      .from("coach_configs")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!coachConfig) {
      await (supabase.from("coach_configs") as any).insert({
        user_id: userId,
        provider: "openai",
        model: "gpt-4o-mini",
      });
    }
  } catch (error) {
    console.warn("Skipping bootstrap seeding", error);
  }
}

export const LIFE_AREA_PALETTE = [
  "#2563EB",
  "#10B981",
  "#F97316",
  "#6366F1",
  "#EC4899",
  "#F59E0B",
  "#14B8A6",
  "#8B5CF6",
] as const;

