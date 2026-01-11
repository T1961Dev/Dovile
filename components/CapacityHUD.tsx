"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

type CapacityHUDProps = {
  capacity: number;
  scheduledCount: number;
  timezone: string;
  selectedDate: string;
  onAddTask?: () => void;
  variant?: "default" | "compact";
};

function parseSafeDate(value: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

export function CapacityHUD({
  capacity,
  scheduledCount,
  timezone,
  selectedDate,
  onAddTask,
  variant = "default",
}: CapacityHUDProps) {
  const blocks = useMemo(
    () => Array.from({ length: capacity }, (_, index) => index < scheduledCount),
    [capacity, scheduledCount],
  );

  const freeSlots = Math.max(capacity - scheduledCount, 0);

  const dateLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
    });
    const safeDate = parseSafeDate(selectedDate);
    const parts = formatter.formatToParts(safeDate);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((entry) => entry.type === type)?.value ?? "";
    return `${part("weekday")} ${part("day")} ${part("month")}`.trim();
  }, [selectedDate, timezone]);

  const containerClasses =
    variant === "compact"
      ? "flex items-center justify-between gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-[#0EA8A8]/20 bg-white/80 px-2 sm:px-3 py-1.5 sm:py-2 shadow-[0_18px_45px_-30px_rgba(14,168,168,0.45)] backdrop-blur-sm w-full sm:w-auto"
      : "flex flex-wrap items-center justify-between gap-6 rounded-[32px] border border-[#7FE5D1]/40 bg-white/80 px-8 py-6 shadow-[0_30px_60px_-32px_rgba(14,168,168,0.4)] backdrop-blur";

  return (
    <div className={containerClasses}>
      <div className="space-y-0">
        <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#0EA8A8]">
          {variant === "compact" ? "Today" : "Today"}
        </p>
        <p className={`font-semibold text-teal-900 ${variant === "compact" ? "text-[10px] sm:text-xs" : "text-xl"}`}>
          {dateLabel}
        </p>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
      <motion.div className="flex items-center gap-0.5" layout>
        {blocks.map((filled, idx) => (
          <motion.span
            key={idx}
            className={`flex origin-bottom rounded-full transition ${
              filled
                ? "bg-[#0EA8A8]"
                : "bg-[#D6FFF3]"
            }`}
            initial={{ scaleY: 0.4, opacity: 0 }}
            animate={{ scaleY: filled ? 1 : 0.75, opacity: 1 }}
            transition={{
              delay: idx * 0.04,
              type: "spring",
              stiffness: 200,
              damping: 18,
            }}
            style={{
              height: variant === "compact" ? 14 : 36,
              width: variant === "compact" ? 4 : 14,
            borderRadius: 999,
          }}
          >
            <span className="sr-only">
              {filled ? `Scheduled block ${idx + 1}` : `Free block ${idx + 1}`}
            </span>
          </motion.span>
        ))}
      </motion.div>
      </div>
        <div className="flex flex-col text-right">
          <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#0EA8A8]">Capacity</span>
          <span className={`font-semibold text-teal-900 ${variant === "compact" ? "text-[10px] sm:text-xs" : "text-xl"}`}>
            {scheduledCount}/{capacity}
          </span>
          <span className="text-[8px] sm:text-[9px] text-[#0EA8A8]">
            {freeSlots > 0 ? `${freeSlots} free` : "Full"}
          </span>
      </div>
    </div>
  );
}

