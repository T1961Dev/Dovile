import { DEFAULT_XP_PER_TASK } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import type { XpSummary } from "@/types/entities";

const LEVEL_BREAKPOINTS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4400];

function toLocalDateString(isoTimestamp: string, timezone: string): string {
  try {
    const d = new Date(isoTimestamp);
    return d.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
  } catch {
    return isoTimestamp.split("T")[0] ?? "";
  }
}

export async function getXpSummary(): Promise<XpSummary> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const settings = await getSettings(supabase);
  const timezone = settings?.timezone ?? "Europe/London";

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

  // Only count task_complete events for streak; use user's timezone for date
  const taskCompleteEvents = data?.filter((evt: { kind: string }) => evt.kind === "task_complete") ?? [];
  const localDates = taskCompleteEvents.map((evt: { created_at: string | null }) =>
    evt.created_at ? toLocalDateString(evt.created_at, timezone) : "",
  );
  const streak = calculateStreak(localDates.filter(Boolean), timezone);

  return {
    totalXp,
    currentLevel: level,
    xpToNextLevel,
    streak,
  };
}

function calculateStreak(localDateStrings: string[], timezone: string) {
  const dates = new Set(localDateStrings);

  if (dates.size === 0) {
    return 0;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const now = new Date();
  const todayIso = formatter.format(now);

  const prevDay = (iso: string) => {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return formatter.format(d);
  };

  let cursor = todayIso;
  if (!dates.has(cursor)) {
    cursor = prevDay(cursor);
    if (!dates.has(cursor)) return 0;
  }

  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = prevDay(cursor);
  }

  return streak;
}

export function calculateTaskXp(completedCount: number) {
  return completedCount * DEFAULT_XP_PER_TASK;
}

