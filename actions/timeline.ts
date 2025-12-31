"use server";

import { getCalendarEventsForDate } from "@/lib/calendar";
import { getResourceBlocks, getHabits, getHabitCompletions, getAllTasks, getIdeas, getLifeAreas, getWorkstreams, getTodayTasks } from "@/lib/queries";
import { calculateAvailableTime } from "@/lib/resource-capacity";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type TimelineData = {
  areas: any[];
  workstreams: any[];
  todayTasks: any[];
  allTasks: any[];
  ideas: any[];
  events?: any[];
  resourceBlocks?: any[];
  habits?: any[];
  habitCompletions?: any[];
  availableTime?: any;
  totalItemCount?: number;
};

export async function getTimelineData(
  date: string,
  mode: string = "day",
  scope: string = "daily",
  timezone: string = "Europe/London"
): Promise<TimelineData> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
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

  // Filter tasks/items based on date and status:
  // - Past dates: only Done tasks for that specific date (both innermost and outer edge)
  // - Today/Future: 
  //   * Innermost circle: pending/in_progress tasks for that specific date
  //   * Outer edge: ALL projects/processes/tasks/ideas (except Done tasks)
  const today = new Date().toISOString().slice(0, 10);
  const isPast = date < today;

  // Get tasks for the specific date (for innermost circle)
  // Past: only Done tasks for that date
  // Today/Future: pending/in_progress tasks for that date
  let dateTasks;
  if (isPast) {
    dateTasks = allTasks.filter((task: any) => task.status === "done" && task.scheduled_for === date);
  } else {
    dateTasks = await getTodayTasks(date, supabase);
  }

  // For full scope (outer edge): 
  // Past: only Done tasks for that date
  // Today/Future: ALL tasks except Done (all pending/in_progress tasks + all ideas)
  const fullScopeTasks = isPast
    ? allTasks.filter((task: any) => task.status === "done" && task.scheduled_for === date)
    : allTasks.filter((task: any) => task.status !== "done");

  // Full scope ideas: 
  // Past: no ideas (only done tasks)
  // Today/Future: all ideas
  const fullScopeIdeas = isPast ? [] : (ideas ?? []);

  const data: TimelineData = {
    areas: areas ?? [],
    workstreams: workstreams ?? [],
    todayTasks: dateTasks ?? [],
    allTasks: fullScopeTasks ?? [],
    ideas: fullScopeIdeas,
    totalItemCount: totalItems?.count ?? 0,
  };

  // Calculate available time (only for daily scope)
  if (scope === "daily") {
    data.availableTime = calculateAvailableTime(
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
    );
    data.events = events;
    data.resourceBlocks = resourceBlocks;
  }

  data.habits = habits;
  data.habitCompletions = habitCompletions;

  return data;
}

