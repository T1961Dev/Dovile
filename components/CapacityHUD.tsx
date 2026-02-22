"use client";

import { useMemo } from "react";

type CapacityHUDProps = {
  capacity: number;
  maxPlanCapacity?: number;
  scheduledCount: number;
  timezone: string;
  selectedDate: string;
  planLabel?: string;
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
  maxPlanCapacity,
  scheduledCount,
  timezone,
  selectedDate,
  planLabel,
  variant = "default",
}: CapacityHUDProps) {
  const blocks = useMemo(
    () => Array.from({ length: capacity }, (_, i) => i < scheduledCount),
    [capacity, scheduledCount],
  );

  const freeSlots = Math.max(capacity - scheduledCount, 0);
  const isAtCapacity = scheduledCount >= capacity;
  const isOverCapacity = scheduledCount > capacity;

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
    <div className={`flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5 shadow-xs w-full sm:w-auto ${!isCompact ? "px-6 py-4" : ""} ${isAtCapacity ? "border-amber-300" : ""} ${isOverCapacity ? "border-destructive" : ""}`}>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Today</p>
        <p className={`font-semibold truncate ${isCompact ? "text-xs" : "text-lg"}`}>{dateLabel}</p>
        {planLabel && (
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{planLabel}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {blocks.map((filled, idx) => (
          <span
            key={idx}
            className={`rounded-full transition ${
              filled
                ? isOverCapacity ? "bg-destructive" : "bg-primary"
                : "bg-secondary"
            }`}
            style={{
              height: isCompact ? 14 : 32,
              width: isCompact ? 3 : 12,
              opacity: filled ? 1 : 0.7,
            }}
          />
        ))}
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Capacity</p>
        <p className={`font-semibold ${isCompact ? "text-xs" : "text-lg"} ${isAtCapacity ? "text-amber-600" : ""} ${isOverCapacity ? "text-destructive" : ""}`}>
          {scheduledCount}/{capacity}
        </p>
        <p className={`text-[10px] ${isAtCapacity ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
          {isOverCapacity
            ? "Over limit"
            : isAtCapacity
              ? "Full"
              : `${freeSlots} free`}
        </p>
        {maxPlanCapacity && maxPlanCapacity > capacity && (
          <p className="text-[9px] text-muted-foreground">
            max {maxPlanCapacity} on plan
          </p>
        )}
      </div>
    </div>
  );
}
