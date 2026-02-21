"use client";

import { useMemo } from "react";

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
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export function CapacityHUD({
  capacity,
  scheduledCount,
  timezone,
  selectedDate,
  variant = "default",
}: CapacityHUDProps) {
  const blocks = useMemo(
    () => Array.from({ length: capacity }, (_, i) => i < scheduledCount),
    [capacity, scheduledCount],
  );

  const freeSlots = Math.max(capacity - scheduledCount, 0);

  const dateLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "short", month: "short", day: "numeric", timeZone: timezone,
    });
    const safeDate = parseSafeDate(selectedDate);
    const parts = formatter.formatToParts(safeDate);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((e) => e.type === type)?.value ?? "";
    return `${part("weekday")} ${part("day")} ${part("month")}`.trim();
  }, [selectedDate, timezone]);

  const isCompact = variant === "compact";

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5 shadow-xs w-full sm:w-auto ${!isCompact ? "px-6 py-4" : ""}`}>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Today</p>
        <p className={`font-semibold ${isCompact ? "text-xs" : "text-lg"}`}>{dateLabel}</p>
      </div>
      <div className="flex items-center gap-0.5">
        {blocks.map((filled, idx) => (
          <span
            key={idx}
            className={`rounded-full transition ${filled ? "bg-primary" : "bg-secondary"}`}
            style={{
              height: isCompact ? 14 : 32,
              width: isCompact ? 3 : 12,
              opacity: filled ? 1 : 0.7,
            }}
          />
        ))}
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Capacity</p>
        <p className={`font-semibold ${isCompact ? "text-xs" : "text-lg"}`}>{scheduledCount}/{capacity}</p>
        <p className="text-[10px] text-muted-foreground">{freeSlots > 0 ? `${freeSlots} free` : "Full"}</p>
      </div>
    </div>
  );
}
