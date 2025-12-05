"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

import type { CalendarEvent } from "@/types/entities";
import { hourToAngle } from "@/lib/resource-capacity";
import type { ResourceBlock } from "@/lib/resource-capacity";

type TwentyFourHourClockProps = {
  events: CalendarEvent[];
  resourceBlocks: ResourceBlock[];
  timezone: string;
  radius?: number;
  onHourClick?: (hour: number) => void;
  onDrop?: (hour: number, itemId: string) => void;
};

const HOUR_LABELS = [12, 3, 6, 9, 12]; // 12, 3, 6, 9, 12 o'clock positions

export function TwentyFourHourClock({
  events,
  resourceBlocks,
  timezone,
  radius = 150,
  onHourClick,
  onDrop,
}: TwentyFourHourClockProps) {
  const size = radius * 2 + 40;
  const roundCoord = (value: number) => Number(value.toFixed(6));

  // Calculate time block arcs - we'll render them directly
  const timeBlockArcs = useMemo(() => {
    return resourceBlocks.filter((block) => block.active);
  }, [resourceBlocks]);

  // Calculate event arcs - we'll render them directly
  const eventArcs = useMemo(() => {
    return events;
  }, [events]);

  const handleDrop = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("bubbleId");
    if (itemId && onDrop) {
      onDrop(hour, itemId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="drop-shadow-sm">
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          {/* Background circle */}
          <circle r={radius} fill="none" stroke="#E2E8F0" strokeWidth={2} />

          {/* Hour markers */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = hourToAngle(i);
            const rad = ((angle + 90) * Math.PI) / 180;
            const markerLength = i % 6 === 0 ? 12 : 6; // Longer markers every 6 hours
            const x1 = roundCoord((radius - markerLength) * Math.cos(rad));
            const y1 = roundCoord((radius - markerLength) * Math.sin(rad));
            const x2 = roundCoord(radius * Math.cos(rad));
            const y2 = roundCoord(radius * Math.sin(rad));

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#94A3B8"
                strokeWidth={i % 6 === 0 ? 2 : 1}
              />
            );
          })}

          {/* Hour labels (12, 3, 6, 9) */}
          {[0, 6, 12, 18].map((hour) => {
            const angle = hourToAngle(hour);
            const rad = ((angle + 90) * Math.PI) / 180;
            const labelRadius = radius - 25;
            const x = roundCoord(labelRadius * Math.cos(rad));
            const y = roundCoord(labelRadius * Math.sin(rad));
            const label = hour === 0 ? 12 : hour;

            return (
              <text
                key={hour}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs font-semibold fill-slate-600"
              >
                {label}
              </text>
            );
          })}

          {/* Resource blocks (sleep, food, etc.) */}
          {timeBlockArcs.map((block) => {
            // Create a full arc path for the time block
            const startAngle = hourToAngle(block.start_hour);
            const endAngle = hourToAngle(block.start_hour + block.duration_hours);
            const sweep = (block.duration_hours / 24) * 360;
            const startRad = ((startAngle + 90) * Math.PI) / 180;
            const endRad = ((endAngle + 90) * Math.PI) / 180;
            const x1 = roundCoord(radius * Math.cos(startRad));
            const y1 = roundCoord(radius * Math.sin(startRad));
            const x2 = roundCoord(radius * Math.cos(endRad));
            const y2 = roundCoord(radius * Math.sin(endRad));
            const largeArc = sweep > 180 ? 1 : 0;
            const arcPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
            
            return (
              <motion.path
                key={block.id ?? block.name}
                d={arcPath}
                fill="none"
                stroke={block.color}
                strokeWidth={20}
                strokeLinecap="round"
                opacity={0.4}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.4 }}
                transition={{ duration: 0.5 }}
              />
            );
          })}

          {/* Calendar events */}
          {eventArcs.map((event) => {
            // Create arc path for calendar event
            const start = new Date(event.start);
            const end = new Date(event.end);
            const startHour = start.getHours() + start.getMinutes() / 60;
            const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            const startAngle = hourToAngle(startHour);
            const endAngle = hourToAngle(startHour + durationHours);
            const sweep = (durationHours / 24) * 360;
            const startRad = ((startAngle + 90) * Math.PI) / 180;
            const endRad = ((endAngle + 90) * Math.PI) / 180;
            const eventRadius = radius + 10;
            const x1 = roundCoord(eventRadius * Math.cos(startRad));
            const y1 = roundCoord(eventRadius * Math.sin(startRad));
            const x2 = roundCoord(eventRadius * Math.cos(endRad));
            const y2 = roundCoord(eventRadius * Math.sin(endRad));
            const largeArc = sweep > 180 ? 1 : 0;
            const eventPath = `M ${x1} ${y1} A ${eventRadius} ${eventRadius} 0 ${largeArc} 1 ${x2} ${y2}`;
            
            return (
              <motion.path
                key={event.id}
                d={eventPath}
                fill="none"
                stroke={event.color ?? "#2563EB"}
                strokeWidth={18}
                strokeLinecap="round"
                opacity={0.6}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ duration: 0.3 }}
              />
            );
          })}

          {/* Drop zones for each hour - larger interactive areas */}
          {Array.from({ length: 24 }).map((_, hour) => {
            const angle = hourToAngle(hour + 0.5); // Center of hour
            const rad = ((angle + 90) * Math.PI) / 180;
            const dropRadius = radius - 10;
            const x = roundCoord(dropRadius * Math.cos(rad));
            const y = roundCoord(dropRadius * Math.sin(rad));

            return (
              <g key={hour}>
                {/* Invisible large drop zone */}
                <circle
                  cx={x}
                  cy={y}
                  r={20}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={40}
                  className="cursor-pointer"
                  onClick={() => onHourClick?.(hour)}
                  onDrop={(e) => handleDrop(e, hour)}
                  onDragOver={handleDragOver}
                />
                {/* Visible hour marker */}
                <circle
                  cx={x}
                  cy={y}
                  r={3}
                  fill="#94A3B8"
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {/* Center circle for "TODAY" label */}
          <circle r={radius - 60} fill="white" stroke="#E2E8F0" strokeWidth={2} />
          <text
            x={0}
            y={-5}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-sm font-semibold fill-slate-800"
          >
            TODAY
          </text>
        </g>
      </svg>
    </div>
  );
}

