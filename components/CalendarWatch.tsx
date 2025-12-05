"use client";

import { motion } from "framer-motion";

import type { CalendarEvent } from "@/types/entities";

type CalendarWatchProps = {
  events: CalendarEvent[];
  radius?: number;
  strokeWidth?: number;
  timezone: string;
};

const MINUTES_IN_DAY = 24 * 60;

export function CalendarWatch({
  events,
  radius = 110,
  strokeWidth = 18,
  timezone,
}: CalendarWatchProps) {
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={radius * 2 + strokeWidth} height={radius * 2 + strokeWidth}>
      <g transform={`translate(${radius + strokeWidth / 2}, ${radius + strokeWidth / 2})`}>
        <circle
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {events.map((event) => {
          const { startOffset, sweep } = getEventArc(event, timezone);
          return (
            <motion.circle
              key={event.id}
              r={radius}
              fill="none"
              stroke={event.color ?? "#2563EB"}
              strokeWidth={strokeWidth}
              strokeDasharray={`${(sweep / 360) * circumference} ${circumference}`}
              strokeDashoffset={-((startOffset / 360) * circumference)}
              strokeLinecap="round"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          );
        })}
      </g>
    </svg>
  );
}

function getEventArc(event: CalendarEvent, timezone: string) {
  const startMinutes = getMinutesInTimezone(event.start, timezone);
  const endMinutes = getMinutesInTimezone(event.end, timezone);
  const duration = Math.max(endMinutes - startMinutes, 15);

  const startOffset = (startMinutes / MINUTES_IN_DAY) * 360;
  const sweep = (duration / MINUTES_IN_DAY) * 360;

  return { startOffset, sweep };
}

function getMinutesInTimezone(iso: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hour, minute] = formatter
    .format(new Date(iso))
    .split(":")
    .map((value) => parseInt(value, 10));
  return hour * 60 + minute;
}

