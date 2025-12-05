import { NextRequest, NextResponse } from "next/server";

import { getCalendarEventsForDate } from "@/lib/calendar";
import { getResourceBlocks, getHabits, getHabitCompletions, getAllTasks, getIdeas, getLifeAreas, getWorkstreams, getTodayTasks } from "@/lib/queries";
import { calculateAvailableTime } from "@/lib/resource-capacity";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const mode = url.searchParams.get("mode"); // Not used yet, but accepted
    const scope = url.searchParams.get("scope") ?? "daily"; // "daily" or "full"
    const timezone = url.searchParams.get("tz") ?? "Europe/London";

    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [areas, workstreams, ideas, events, resourceBlocks, habits, habitCompletions, totalItems, allTasks] = await Promise.all([
      getLifeAreas(supabase),
      getWorkstreams(supabase),
      getIdeas(supabase),
      scope === "daily" ? getCalendarEventsForDate(user.id, date, timezone) : Promise.resolve([]),
      scope === "daily" ? getResourceBlocks(supabase) : Promise.resolve([] as any[]),
      getHabits(supabase),
      getHabitCompletions(date, supabase),
      supabase.from("items").select("id", { count: "exact", head: true }),
      getAllTasks(supabase),
    ]);

    const timelineTasks = scope === "full" ? allTasks : await getTodayTasks(date, supabase);

    const data = {
      areas: areas ?? [],
      workstreams: workstreams ?? [],
      todayTasks: timelineTasks ?? [],
      allTasks: allTasks ?? [],
      ideas: ideas ?? [],
      totalItemCount: totalItems?.count ?? 0,
    };

    // Calculate available time (only for daily scope)
    const capacity = scope === "daily" 
      ? calculateAvailableTime(
          date,
          events,
          resourceBlocks.map((block) => ({
            name: block.name,
            start_hour: block.start_hour,
            duration_hours: Number(block.duration_hours),
            color: block.color,
            active: block.active,
          })),
          timezone,
        )
      : null;

    return NextResponse.json({
      ...data,
      events: scope === "daily" ? events : [],
      resourceBlocks: scope === "daily" ? resourceBlocks : [],
      habits,
      habitCompletions,
      availableTime: capacity,
    });
  } catch (error) {
    console.error("Timeline API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
