"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { format, addDays, parseISO, isSameDay, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import { useDashboardStore } from "@/store/useDashboardStore";

type DayByDayTimelineProps = {
  timezone: string;
};

const DAYS_TO_SHOW = 14; // 2 weeks visible

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

  // Generate days: 7 days before today, today, 14 days after today
  const days = useMemo(() => {
    const startDate = addDays(today, -7);
    return Array.from({ length: DAYS_TO_SHOW + 7 }, (_, i) => addDays(startDate, i));
  }, [today]);

  // Calculate pointer position
  const pointerPosition = useMemo(() => {
    const selectedIndex = days.findIndex((day) => isSameDay(day, selectedDateObj));
    if (selectedIndex === -1) return 50; // Default to center if not found
    
    const totalDays = days.length;
    const position = (selectedIndex / (totalDays - 1)) * 100;
    return Math.max(0, Math.min(100, position));
  }, [days, selectedDateObj]);

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    setSelectedDate(dateStr);
  }, [setSelectedDate]);

  const handlePointerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handlePointerTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const dayIndex = Math.round((percentage / 100) * (days.length - 1));
      const selectedDay = days[dayIndex];
      if (selectedDay && !isSameDay(selectedDay, selectedDateObj)) {
        handleDayClick(selectedDay);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const dayIndex = Math.round((percentage / 100) * (days.length - 1));
      const selectedDay = days[dayIndex];
      if (selectedDay && !isSameDay(selectedDay, selectedDateObj)) {
        handleDayClick(selectedDay);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, days, selectedDateObj, handleDayClick]);

  // Scroll to show selected date
  useEffect(() => {
    if (!timelineRef.current || !pointerRef.current) return;
    const container = timelineRef.current;
    const pointer = pointerRef.current;
    const containerWidth = container.offsetWidth;
    const pointerLeft = (pointerPosition / 100) * containerWidth;
    const scrollLeft = pointerLeft - containerWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
  }, [pointerPosition]);

  return (
    <div className="w-full bg-white/95 backdrop-blur-sm border-t border-[#0EA8A8]/20 shadow-lg pt-4 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative">
          {/* Timeline line */}
          <div
            ref={timelineRef}
            className="relative h-16 overflow-x-auto overflow-y-hidden scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div className="flex items-center h-full min-w-full" style={{ minWidth: `${days.length * 60}px` }}>
              {days.map((day, index) => {
                const isSelected = isSameDay(day, selectedDateObj);
                const isToday = isSameDay(day, today);
                const isPast = day < today;

                return (
                  <div
                    key={format(day, "yyyy-MM-dd")}
                    className="flex flex-col items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                    style={{ width: "60px" }}
                    onClick={() => handleDayClick(day)}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mb-1 transition-all ${
                        isSelected
                          ? "bg-[#0EA8A8] w-3 h-3"
                          : isToday
                          ? "bg-[#FFD833]"
                          : isPast
                          ? "bg-[#195552]/30"
                          : "bg-[#0EA8A8]/30"
                      }`}
                    />
                    <div
                      className={`text-[10px] font-medium transition-all ${
                        isSelected
                          ? "text-[#0B1918] font-semibold"
                          : isToday
                          ? "text-[#0B1918]"
                          : "text-[#195552]"
                      }`}
                    >
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={`text-[9px] transition-all ${
                        isSelected
                          ? "text-[#0B1918] font-semibold"
                          : "text-[#195552]/70"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Draggable pointer */}
            <div
              ref={pointerRef}
              className={`absolute top-0 bottom-0 w-0.5 bg-[#0EA8A8] z-10 cursor-grab active:cursor-grabbing transition-transform ${
                isDragging ? "scale-110" : ""
              }`}
              style={{ left: `${pointerPosition}%`, transform: `translateX(-50%)` }}
              onMouseDown={handlePointerMouseDown}
              onTouchStart={handlePointerTouchStart}
            >
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full -mt-1">
                <motion.div
                  className="w-3 h-3 bg-[#0EA8A8] rounded-full shadow-lg"
                  animate={{ scale: isDragging ? 1.2 : 1 }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>
          </div>

          {/* Selected date label */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-2 text-center">
            <div className="text-xs font-semibold text-[#0B1918] bg-white px-3 py-1 rounded-full border border-[#0EA8A8]/20 shadow-sm">
              {format(selectedDateObj, "EEEE, MMMM d")}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

