"use client";

import { useBubbleStore } from "@/store/bubbles";
import { useDashboardStore } from "@/store/useDashboardStore";
import { ScopeZoom } from "@/components/ScopeZoom";

type ScopeZoomControlProps = {
  timezone?: string;
};

export function ScopeZoomControl({ timezone = "Europe/London" }: ScopeZoomControlProps) {
  const zoomLevel = useBubbleStore((state) => state.zoomLevel);
  const setZoomLevel = useBubbleStore((state) => state.setZoomLevel);
  const hydrateBubbles = useBubbleStore((state) => state.hydrateFromServer);
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const setSelectedDate = useDashboardStore((state) => state.setSelectedDate);
  const timelineMode = useDashboardStore((state) => state.timelineMode);

  const handleZoomChange = async (zoom: "daily" | "full") => {
    // Always reset to today's date and center the view when "Today" is clicked
    const today = new Date().toISOString().slice(0, 10);
    setSelectedDate(today);
    setZoomLevel("day");
    
    // Trigger a center view by dispatching a custom event
    window.dispatchEvent(new CustomEvent('center-view'));
    
    // Always use "full" scope since full scope is visible from today onwards
    try {
      const { getTimelineData } = await import("@/actions/timeline");
      const payload = await getTimelineData(today, timelineMode, "full", timezone);
      const wheelItems = [
        ...(payload.allTasks ?? payload.todayTasks ?? []),
        ...(payload.ideas ?? []),
      ];
      hydrateBubbles({
        lifeAreas: payload.areas ?? [],
        workstreams: payload.workstreams ?? [],
        items: wheelItems,
      });
    } catch (error) {
      console.error("Failed to update zoom:", error);
    }
  };

  return (
    <ScopeZoom
      currentZoom="daily"
      onZoomChange={handleZoomChange}
    />
  );
}

