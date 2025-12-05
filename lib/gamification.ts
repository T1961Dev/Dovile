import { DEFAULT_XP_PER_TASK } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { XpSummary } from "@/types/entities";

const LEVEL_BREAKPOINTS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4400];

export async function getXpSummary(): Promise<XpSummary> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await (supabase
    .from("xp_events")
    .select("amount, kind, created_at") as any)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const totalXp = data?.reduce((sum: number, evt: { amount: number }) => sum + evt.amount, 0) ?? 0;

  let level = 1;
  for (let i = 0; i < LEVEL_BREAKPOINTS.length; i++) {
    const threshold = LEVEL_BREAKPOINTS[i]!;
    if (totalXp >= threshold) {
      level = i + 1;
    } else {
      break;
    }
  }

  const nextThreshold = LEVEL_BREAKPOINTS[level] ?? LEVEL_BREAKPOINTS[LEVEL_BREAKPOINTS.length - 1]! + 1000;
  const xpToNextLevel = Math.max(nextThreshold - totalXp, 0);

  // Only count task_complete events for streak calculation
  const taskCompleteEvents = data?.filter((evt: { kind: string }) => evt.kind === "task_complete") ?? [];
  const streak = calculateStreak(taskCompleteEvents.map((evt: { created_at: string | null }) => evt.created_at));

  return {
    totalXp,
    currentLevel: level,
    xpToNextLevel,
    streak,
  };
}

function calculateStreak(completionTimestamps: (string | null)[]) {
  const dates = new Set(
    completionTimestamps
      .filter(Boolean)
      .map((timestamp) => timestamp!.split("T")[0]!),
  );

  if (dates.size === 0) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  // Check if today has a completion
  const todayIso = cursor.toISOString().split("T")[0]!;
  if (!dates.has(todayIso)) {
    // If today doesn't have a completion, check yesterday
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Count consecutive days backwards from today (or yesterday if today has no completion)
  while (dates.has(cursor.toISOString().split("T")[0]!)) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export function calculateTaskXp(completedCount: number) {
  return completedCount * DEFAULT_XP_PER_TASK;
}

