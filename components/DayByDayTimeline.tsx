"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { format, addDays, parseISO, isSameDay, startOfDay } from "date-fns";
import { useDashboardStore } from "@/store/useDashboardStore";

type DayByDayTimelineProps = {
  timezone: string;
};

const DAYS_TO_SHOW = 14;

export function DayByDayTimeline({ timezone }: DayByDayTimelineProps) {
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const setSelectedDate = useDashboardStore((state) => state.setSelectedDate);
  const timelineRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return today;
    const parsed = parseISO(selectedDate);
    return isNaN(parsed.getTime()) ? today : startOfDay(parsed);
  }, [selectedDate, today]);

  const days = useMemo(() => {
    const startDate = addDays(today, -7);
    return Array.from({ length: DAYS_TO_SHOW + 7 }, (_, i) => addDays(startDate, i));
  }, [today]);

  const DAY_WIDTH = 44;
  const selectedDayIndex = useMemo(() => {
    const idx = days.findIndex((day) => isSameDay(day, selectedDateObj));
    return idx === -1 ? Math.floor(days.length / 2) : idx;
  }, [days, selectedDateObj]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
  }, [setSelectedDate]);

  const handlePointerMouseDown = (e: React.MouseEvent) => { e.preventDefault(); setIsDragging(true); };
  const handlePointerTouchStart = (e: React.TouchEvent) => { e.preventDefault(); setIsDragging(true); };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (clientX: number) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const xInContent = clientX - rect.left + scrollLeft;
      const idx = Math.max(0, Math.min(days.length - 1, Math.floor(xInContent / DAY_WIDTH)));
      const day = days[idx];
      if (day && !isSameDay(day, selectedDateObj)) handleDayClick(day);
    };
    const onMouse = (e: MouseEvent) => handleMove(e.clientX);
    const onTouch = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMouse);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onTouch, { passive: false });
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMouse);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onTouch);
      document.removeEventListener("touchend", onUp);
    };
  }, [isDragging, days, selectedDateObj, handleDayClick]);

  useEffect(() => {
    if (!timelineRef.current) return;
    const el = timelineRef.current;
    const targetCenter = selectedDayIndex * DAY_WIDTH + DAY_WIDTH / 2;
    const scrollLeft = targetCenter - el.offsetWidth / 2;
    el.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
  }, [selectedDayIndex]);

  return (
    <div className="rounded-lg border bg-card shadow-sm px-3 py-1.5 w-full">
      <div
        ref={timelineRef}
        className="relative h-9 overflow-x-auto overflow-y-hidden touch-pan-x"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="relative h-full" style={{ width: `${days.length * DAY_WIDTH}px` }}>
          <div className="flex items-center h-full">
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDateObj);
              const isToday = isSameDay(day, today);
              const isPast = day < today;
              return (
                <div
                  key={format(day, "yyyy-MM-dd")}
                  className="flex flex-col items-center justify-center shrink-0 cursor-pointer transition-all touch-manipulation active:scale-95"
                  style={{ width: `${DAY_WIDTH}px` }}
                  onClick={() => handleDayClick(day)}
                  onTouchEnd={(e) => { e.preventDefault(); handleDayClick(day); }}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-all ${
                    isSelected ? "bg-primary w-2.5 h-2.5" : isToday ? "bg-primary/70" : isPast ? "bg-muted-foreground/25" : "bg-primary/25"
                  }`} />
                  <span className={`text-[10px] leading-none ${isSelected ? "font-semibold text-foreground" : isToday ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {format(day, "EEE")}
                  </span>
                  <span className={`text-[9px] leading-none mt-0.5 ${isSelected ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pointer line - positioned inside scrollable content so it stays in sync */}
          <div
            ref={pointerRef}
            className={`absolute top-0 bottom-0 w-0.5 bg-primary z-10 cursor-grab active:cursor-grabbing ${isDragging ? "opacity-80" : ""}`}
            style={{ left: `${selectedDayIndex * DAY_WIDTH + DAY_WIDTH / 2}px`, transform: "translateX(-50%)" }}
            onMouseDown={handlePointerMouseDown}
            onTouchStart={handlePointerTouchStart}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full -mt-0.5">
              <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center pt-0.5">
        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          {format(selectedDateObj, "EEEE, MMMM d")}
        </span>
      </div>
    </div>
  );
}
