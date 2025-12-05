import type { CalendarEvent } from "@/types/entities";

export type ResourceBlock = {
  id?: string;
  name: string;
  start_hour: number;
  duration_hours: number;
  color: string;
  active: boolean;
};

/**
 * Calculate available time for tasks after accounting for:
 * - GCal events (meetings, appointments)
 * - Predefined resource blocks (sleep, food, exercise, etc.)
 */
export function calculateAvailableTime(
  date: string,
  events: CalendarEvent[],
  resourceBlocks: ResourceBlock[],
  timezone: string,
): {
  totalHours: number;
  availableHours: number;
  blockedHours: number;
  breakdown: {
    calendarEvents: number;
    resourceBlocks: number;
  };
} {
  const totalHours = 24;
  let blockedMinutes = 0;

  // Calculate blocked time from calendar events
  const calendarBlockedMinutes = events.reduce((total, event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = (end.getTime() - start.getTime()) / (1000 * 60); // minutes
    return total + Math.max(0, duration);
  }, 0);

  // Calculate blocked time from resource blocks
  const resourceBlockedMinutes = resourceBlocks
    .filter((block) => block.active)
    .reduce((total, block) => {
      return total + block.duration_hours * 60;
    }, 0);

  blockedMinutes = calendarBlockedMinutes + resourceBlockedMinutes;

  const availableHours = Math.max(0, totalHours - blockedMinutes / 60);

  return {
    totalHours,
    availableHours: Math.round(availableHours * 10) / 10, // Round to 1 decimal
    blockedHours: Math.round((blockedMinutes / 60) * 10) / 10,
    breakdown: {
      calendarEvents: Math.round((calendarBlockedMinutes / 60) * 10) / 10,
      resourceBlocks: Math.round((resourceBlockedMinutes / 60) * 10) / 10,
    },
  };
}

/**
 * Convert hour (0-23) to angle in degrees for clock visualization
 */
export function hourToAngle(hour: number): number {
  // 0 = 12 o'clock (top), 6 = 6 o'clock (bottom)
  // Clock starts at top (12) and goes clockwise
  return ((hour % 24) / 24) * 360 - 90; // -90 to start at top
}

/**
 * Get time block arc for SVG rendering
 */
export function getTimeBlockArc(
  startHour: number,
  durationHours: number,
  radius: number,
): { startAngle: number; endAngle: number; sweep: number; path: string } {
  const startAngle = hourToAngle(startHour);
  const endAngle = hourToAngle(startHour + durationHours);
  const sweep = (durationHours / 24) * 360;

  // Convert angles to radians for SVG
  const startRad = ((startAngle + 90) * Math.PI) / 180;
  const endRad = ((endAngle + 90) * Math.PI) / 180;

  const x1 = radius * Math.cos(startRad);
  const y1 = radius * Math.sin(startRad);
  const x2 = radius * Math.cos(endRad);
  const y2 = radius * Math.sin(endRad);

  const largeArc = sweep > 180 ? 1 : 0;

  // Use arc path with proper sweep direction
  const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

  return { startAngle, endAngle, sweep, path };
}

