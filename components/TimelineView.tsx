// Simplified timeline view from reference design
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { HabitsTracker, type Habit, type HabitCompletion } from "@/components/HabitsTracker";
import { TwentyFourHourClock } from "@/components/TwentyFourHourClock";
import type { ResourceBlock } from "@/lib/resource-capacity";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useBubbleStore } from "@/store/bubbles";
import { ChevronDown, ChevronUp } from "lucide-react";

type TimelineViewProps = {
  timezone: string;
};

const DAY_SEGMENTS = [
  { label: "Early (6-9)", startHour: 6, endHour: 9 },
  { label: "Morning (9-12)", startHour: 9, endHour: 12 },
  { label: "Afternoon (12-15)", startHour: 12, endHour: 15 },
  { label: "Focus (15-18)", startHour: 15, endHour: 18 },
  { label: "Evening (18-21)", startHour: 18, endHour: 21 },
  { label: "Late (21-24)", startHour: 21, endHour: 24 },
];

type TimelineBucket = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  items: TimelineItem[];
};

type TimelineItem = {
  id: string;
  title: string;
  type: "task" | "idea";
  scheduledFor?: Date | null;
};

function parseNullableISO(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildBuckets(
  mode: ReturnType<typeof useDashboardStore.getState>["timelineMode"],
  anchor: Date,
  tasks: TimelineItem[],
  ideas: TimelineItem[],
): TimelineBucket[] {
  const base = startOfDay(anchor);
  const allItems = [...tasks, ...ideas];

  if (mode === "day") {
    return DAY_SEGMENTS.map((segment, index) => {
      const start = new Date(base);
      start.setHours(segment.startHour, 0, 0, 0);
      const end = new Date(base);
      end.setHours(segment.endHour, 0, 0, 0);
      const items = allItems.filter((item) => {
        if (!item.scheduledFor) return false;
        return item.scheduledFor >= start && item.scheduledFor < end;
      });
      return {
        id: `day-${index}`,
        label: segment.label,
        start,
        end,
        items,
      };
    });
  }

  if (mode === "week") {
    const weekStart = startOfWeek(base, { weekStartsOn: 1 });
    return Array.from({ length: 7 }).map((_, index) => {
      const start = addDays(weekStart, index);
      const end = addDays(start, 1);
      const items = allItems.filter((item) => {
        if (!item.scheduledFor) return false;
        return item.scheduledFor >= start && item.scheduledFor < end;
      });
      return {
        id: `week-${index}`,
        label: format(start, "EEE dd"),
        start,
        end,
        items,
      };
    });
  }

  if (mode === "quarter") {
    const quarterStart = startOfQuarter(base);
    return Array.from({ length: 12 }).map((_, index) => {
      const start = addWeeks(quarterStart, index);
      const end = addWeeks(start, 1);
      const items = allItems.filter((item) => {
        if (!item.scheduledFor) return false;
        return item.scheduledFor >= start && item.scheduledFor < end;
      });
      return {
        id: `quarter-${index}`,
        label: format(start, "MMM d"),
        start,
        end,
        items,
      };
    });
  }

  // year
  const yearStart = startOfMonth(new Date(base.getFullYear(), 0, 1));
  return Array.from({ length: 12 }).map((_, index) => {
    const start = addMonths(yearStart, index);
    const end = addMonths(start, 1);
    const items = allItems.filter((item) => {
      if (!item.scheduledFor) return false;
      return item.scheduledFor >= start && item.scheduledFor < end;
    });
    return {
      id: `year-${index}`,
      label: format(start, "MMM"),
      start,
      end,
      items,
    };
  });
}

export function TimelineView({ timezone }: TimelineViewProps) {
  const timelineMode = useDashboardStore((state) => state.timelineMode);
  const setTimelineMode = useDashboardStore((state) => state.setTimelineMode);
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const setSelectedDate = useDashboardStore((state) => state.setSelectedDate);
  const tasks = useDashboardStore((state) => state.tasks);
  const ideas = useDashboardStore((state) => state.ideas);
  const hydrate = useDashboardStore((state) => state.hydrate);
  const setEvents = useDashboardStore((state) => state.setEvents);
  const setZoomLevel = useBubbleStore((state) => state.setZoomLevel);
  const zoomLevel = useBubbleStore((state) => state.zoomLevel);
  const setBubbleSelectedDate = useBubbleStore((state) => state.setSelectedDate);
  const hydrateBubbles = useBubbleStore((state) => state.hydrateFromServer);
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitCompletions, setHabitCompletions] = useState<HabitCompletion[]>([]);
  const [resourceBlocks, setResourceBlocks] = useState<ResourceBlock[]>([]);
  const [availableTime, setAvailableTime] = useState<{
    totalHours: number;
    availableHours: number;
    blockedHours: number;
    breakdown?: {
      calendarEvents: number;
      resourceBlocks: number;
    };
  } | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const events = useDashboardStore((state) => state.events);
  const [showTimeAllocation, setShowTimeAllocation] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);

  const safeSelectedDate = (() => {
    const parsed = parseNullableISO(selectedDate);
    return parsed ?? new Date();
  })();

  const tasksWithDates: TimelineItem[] = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: "task",
        scheduledFor: parseNullableISO(task.scheduled_for ?? null),
      })),
    [tasks],
  );

  const ideasWithDates: TimelineItem[] = useMemo(
    () =>
      ideas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        type: "idea",
        scheduledFor: parseNullableISO(idea.scheduled_for ?? null),
      })),
    [ideas],
  );

  const buckets = useMemo(
    () => buildBuckets(timelineMode, safeSelectedDate, tasksWithDates, ideasWithDates),
    [timelineMode, safeSelectedDate, tasksWithDates, ideasWithDates],
  );

  useEffect(() => {
    // Don't override zoomLevel from timelineMode - they're independent
    if (selectedDate) {
      const currentZoom = zoomLevel || "day";
      const scope = currentZoom === "day" ? "daily" : "full";
      (async () => {
        try {
          const { getTimelineData } = await import("@/actions/timeline");
          const payload = await getTimelineData(selectedDate, timelineMode, scope, timezone);
          hydrate({
            date: selectedDate,
            areas: payload.areas ?? [],
            workstreams: payload.workstreams ?? [],
            tasks: payload.todayTasks ?? [],
            ideas: payload.ideas ?? [],
            events: payload.events ?? [],
          });
          // For timeline: show appropriate items based on date
          // Past dates: done tasks only
          // Today: pending/in_progress tasks + all ideas
          // Future: pending/in_progress tasks + all ideas  
          // Full scope from today: all items except done tasks
          const today = new Date().toISOString().slice(0, 10);
          const isPast = selectedDate < today;
          const isToday = selectedDate === today;
          
          const wheelItems = isPast
            ? [
                ...(payload.todayTasks?.filter((t: any) => t.status === "done") ?? []),
                ...(payload.ideas ?? []),
              ]
            : [
                ...(payload.todayTasks ?? []),
                ...(payload.ideas ?? []),
              ];
          hydrateBubbles({
            lifeAreas: payload.areas ?? [],
            workstreams: payload.workstreams ?? [],
            items: wheelItems,
          });
          if (payload.events) setEvents(payload.events);
          if (payload.habits) setHabits(payload.habits);
          if (payload.habitCompletions) setHabitCompletions(payload.habitCompletions);
          if (payload.resourceBlocks) setResourceBlocks(payload.resourceBlocks);
          if (payload.availableTime) setAvailableTime(payload.availableTime);
          
          // Debug: Log what we're getting
          console.log("Timeline payload:", {
            events: payload.events?.length ?? 0,
            resourceBlocks: payload.resourceBlocks?.length ?? 0,
            availableTime: payload.availableTime,
          });
        } catch (error) {
          console.error("Failed to reload timeline data:", error);
        }
      })();
    }
  }, [setZoomLevel, timelineMode, timezone, hydrate, hydrateBubbles, setEvents, selectedDate, zoomLevel]);

  useEffect(() => {
    setBubbleSelectedDate(safeSelectedDate.toISOString().slice(0, 10));
  }, [safeSelectedDate, setBubbleSelectedDate]);

  const handleToggleHabit = async (habitId: string, date: string) => {
    try {
      const response = await fetch(`/api/habits/${habitId}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
        credentials: "include",
      });
      const data = await response.json();
      if (data.completed) {
        setHabitCompletions([...habitCompletions, { habit_id: habitId, completed_at: date }]);
      } else {
        setHabitCompletions(habitCompletions.filter((c) => !(c.habit_id === habitId && c.completed_at === date)));
      }
    } catch (error) {
      console.error("Failed to toggle habit:", error);
    }
  };

  const handleDropOnHour = async (hour: number, itemId: string) => {
    // TODO: Implement scheduling task to specific hour
    console.log("Drop item", itemId, "on hour", hour);
  };

  return (
    <div className="w-full px-4 py-6 sm:px-8 space-y-6 bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.1)]">
      {/* Timeline Header with Collapse Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#0B1918]">
          Timeline — {format(safeSelectedDate, "dd MMM yyyy")}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {(["day", "week", "quarter", "year"] as const).map((mode) => (
              <Button
                key={mode}
                variant={timelineMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimelineMode(mode)}
                className={
                  timelineMode === mode
                    ? "bg-[#0EA8A8] text-white"
                    : "text-[#0EA8A8] hover:bg-[#0EA8A8]/10"
                }
              >
                {mode === "day"
                  ? "Day"
                  : mode === "week"
                  ? "Week"
                  : mode === "quarter"
                  ? "Quarter"
                  : "Year"}
              </Button>
            ))}
          </div>
          <button
            type="button"
            aria-expanded={showTimeline}
            aria-controls="timeline-content"
            onClick={() => setShowTimeline((prev) => !prev)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#0EA8A8] hover:text-[#0B1918] focus:outline-none px-2 py-1 rounded-md hover:bg-[#0EA8A8]/10 transition-colors"
          >
            {showTimeline ? (
              <>
                <span className="sr-only">Collapse timeline</span>
                <ChevronUp className="h-5 w-5" aria-hidden="true" />
              </>
            ) : (
              <>
                <span className="sr-only">Expand timeline</span>
                <ChevronDown className="h-5 w-5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      {showTimeline && (
        <div id="timeline-content" className="space-y-6">
          {/* Habits Tracker */}
          {habits.length > 0 && (
            <HabitsTracker
              habits={habits}
              completions={habitCompletions}
              today={selectedDate || format(new Date(), "yyyy-MM-dd")}
              onToggleCompletion={handleToggleHabit}
            />
          )}

          {/* 24-Hour Clock with Resource Blocks */}
          {timelineMode === "day" && (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#0EA8A8]/20 bg-white/80 p-6 shadow-sm">
              <div className="flex w-full items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-[#0B1918]">
                  Today's Time Allocation
                </h3>
                <button
                  type="button"
                  aria-expanded={showTimeAllocation}
                  aria-controls="time-allocation-panel"
                  onClick={() => setShowTimeAllocation((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0EA8A8] hover:text-[#0B1918] focus:outline-none"
                >
                  {showTimeAllocation ? "Hide" : "Show"}
                  {showTimeAllocation ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {showTimeAllocation && (
                <div id="time-allocation-panel" className="flex flex-col items-center gap-4 w-full">
                  <TwentyFourHourClock
                    events={events}
                    resourceBlocks={resourceBlocks}
                    timezone={timezone}
                    onDrop={handleDropOnHour}
                  />
                  {availableTime && (
                    <div className="text-center">
                      <p className="text-xs text-[#195552]">
                        Available for tasks: <span className="font-semibold text-[#0EA8A8]">{availableTime.availableHours}h</span>
                      </p>
                      <p className="text-[10px] text-[#195552]/70 mt-1">
                        Blocked: {availableTime.blockedHours}h (GCal: {availableTime.breakdown?.calendarEvents ?? 0}h, 
                        Resources: {availableTime.breakdown?.resourceBlocks ?? 0}h)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timeline Buckets */}
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-4">
        {buckets.map((bucket) => {
          const hasItems = bucket.items.length > 0;
          // For day mode, only mark active if this specific bucket is selected
          // For other modes, check if it's the selected date
          const bucketDate = startOfDay(bucket.start);
          const selectedDateObj = startOfDay(safeSelectedDate);
          const bucketDateStr = bucketDate.toISOString().slice(0, 10);
          const selectedDateStr = selectedDateObj.toISOString().slice(0, 10);
          const isActive = timelineMode === "day"
            ? selectedBucketId === bucket.id
            : bucketDateStr === selectedDateStr;

          return (
            <button
              key={bucket.id}
              onClick={async () => {
                const newDate = startOfDay(bucket.start).toISOString().slice(0, 10);
                setSelectedDate(newDate);
                setSelectedBucketId(bucket.id);
                try {
                  const scope = zoomLevel === "day" ? "daily" : "full";
                  const { getTimelineData } = await import("@/actions/timeline");
                  const payload = await getTimelineData(newDate, timelineMode, scope, timezone);
                  
                  hydrate({
                    date: newDate,
                    areas: payload.areas ?? [],
                    workstreams: payload.workstreams ?? [],
                    tasks: payload.todayTasks ?? [],
                    ideas: payload.ideas ?? [],
                    events: payload.events ?? [],
                  });
                  // Filter items based on date for timeline view
                  const today = new Date().toISOString().slice(0, 10);
                  const isPast = newDate < today;
                  const wheelItems = isPast
                    ? [
                        ...(payload.todayTasks?.filter((t: any) => t.status === "done") ?? []),
                        ...(payload.ideas ?? []),
                      ]
                    : [
                        ...(payload.todayTasks ?? []),
                        ...(payload.ideas ?? []),
                      ];
                  hydrateBubbles({
                    lifeAreas: payload.areas ?? [],
                    workstreams: payload.workstreams ?? [],
                    items: wheelItems,
                  });
                  if (payload.events) setEvents(payload.events);
                  if (payload.habits) setHabits(payload.habits);
                  if (payload.habitCompletions) setHabitCompletions(payload.habitCompletions);
                  if (payload.resourceBlocks) setResourceBlocks(payload.resourceBlocks);
                  if (payload.availableTime) setAvailableTime(payload.availableTime);
                  
                } catch (error) {
                  console.error("Failed to load timeline data:", error);
                }
              }}
              className="flex h-28 w-36 flex-shrink-0 flex-col items-start justify-between rounded-xl border border-transparent bg-white p-3 text-left shadow-sm transition hover:border-[#0EA8A8]/40 focus:outline-none"
            >
              <div>
                <p className={`text-xs font-semibold ${hasItems ? "text-[#0EA8A8]" : "text-[#195552]"}`}>
                  {bucket.label}
                </p>
                <p className="text-[10px] text-[#195552]/80">
                  {format(bucket.start, "dd MMM")} – {format(bucket.end, "dd MMM")}
                </p>
              </div>
              <div className="flex w-full flex-col gap-1">
                {bucket.items.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    className="truncate rounded-full bg-[#FDFBF6] px-2 py-1 text-[10px] text-[#0B1918]"
                  >
                    {item.type === "task" ? "✔︎" : "💡"} {item.title}
                  </span>
                ))}
                {bucket.items.length > 3 ? (
                  <span className="text-[10px] text-[#0EA8A8]">
                    +{bucket.items.length - 3} more
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
