"use client";

import { useCallback, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { motion } from "framer-motion";

import { useDashboardStore, type TimelineMode } from "@/store/useDashboardStore";

type TimelineProps = {
  selectedDate: string;
  timezone: string;
  mode: TimelineMode;
};

const MODES: { label: string; value: TimelineMode }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Quarter", value: "quarter" },
  { label: "Year", value: "year" },
];

export function Timeline({ selectedDate, timezone, mode }: TimelineProps) {
  const setSelectedDate = useDashboardStore((state) => state.setSelectedDate);
  const setTimelineMode = useDashboardStore((state) => state.setTimelineMode);
  const setEvents = useDashboardStore((state) => state.setEvents);
  const hydrate = useDashboardStore((state) => state.hydrate);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => buildDays(mode, selectedDate), [mode, selectedDate]);

  const handleSelectDay = useCallback(
    async (date: string) => {
      if (loading) return;
      setSelectedDate(date);
      setLoading(true);
      try {
        const { getTimelineData } = await import("@/actions/timeline");
        const payload = await getTimelineData(date, mode, "daily", timezone);
        hydrate({
          date,
          areas: payload.areas,
          workstreams: payload.workstreams,
          tasks: payload.todayTasks,
          ideas: payload.ideas,
          events: payload.events ?? [],
        });
        setEvents(payload.events ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [hydrate, loading, mode, setEvents, setSelectedDate, timezone],
  );

  const handleModeChange = (nextMode: TimelineMode) => {
    setTimelineMode(nextMode);
  };

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-indigo-50 bg-white/90 p-6 shadow-[0_30px_70px_-40px_rgba(99,102,241,0.55)] backdrop-blur">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-200/40 to-transparent blur-3xl" />
        <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-gradient-to-br from-violet-200/35 to-transparent blur-3xl" />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#0EA8A8]">Timeline</p>
          <p className="text-lg font-semibold text-slate-900">
            {format(parseISO(selectedDate), "EEEE, MMM d")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#0EA8A8]/10 p-1">
          {MODES.map((item) => (
            <button
              key={item.value}
              onClick={() => handleModeChange(item.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                item.value === mode
                  ? "bg-white text-[#0EA8A8] shadow-[0_8px_20px_-10px_rgba(14,168,168,0.6)]"
                  : "text-[#0EA8A8]/60 hover:text-[#0EA8A8]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <motion.div
        className="relative mt-6 flex w-full gap-3 overflow-x-auto pb-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          return (
            <button
              key={day.date}
              onClick={() => handleSelectDay(day.date)}
              className={`flex min-w-[80px] flex-col items-center gap-1 rounded-3xl border px-4 py-3 text-xs transition ${
                isSelected
                  ? "border-transparent bg-[#0EA8A8] text-white shadow-[0_18px_30px_-20px_rgba(14,168,168,0.9)] hover:bg-[#0C8F90]"
                  : "border-white/80 bg-white/80 text-slate-600 shadow-[0_10px_25px_-22px_rgba(99,102,241,0.45)] hover:border-[#0EA8A8]/20 hover:text-[#0EA8A8]"
              }`}
            >
              <span
                className={`text-[10px] uppercase tracking-[0.25em] ${
                  isSelected ? "text-white/80" : "text-[#0EA8A8]/50"
                }`}
              >
                {day.weekday}
              </span>
              <span className="text-lg font-semibold">{day.day}</span>
              <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                {day.month}
              </span>
            </button>
          );
        })}
      </motion.div>
      {loading && (
        <p className="relative mt-2 text-center text-xs text-[#0EA8A8]">Loading day context…</p>
      )}
    </div>
  );
}

type TimelineDay = {
  date: string;
  weekday: string;
  month: string;
  day: string;
};

function buildDays(mode: TimelineMode, anchorDate: string): TimelineDay[] {
  const center = parseISO(anchorDate);
  let span = 7;

  switch (mode) {
    case "day":
      span = 7;
      break;
    case "week":
      span = 21;
      break;
    case "quarter":
      span = 90;
      break;
    case "year":
      span = 365;
      break;
  }

  const totalDays = Math.min(span, 60);
  const half = Math.floor(totalDays / 2);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(center, index - half);
    return {
      date: format(date, "yyyy-MM-dd"),
      weekday: format(date, "EEE"),
      month: format(date, "MMM"),
      day: format(date, "d"),
    };
  });
}

