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
  const timelineMode = useDashboardStore((state) => state.timelineMode);

  const handleZoomChange = (zoom: "daily" | "full") => {
    const newZoom = zoom === "daily" ? "day" : "year";
    setZoomLevel(newZoom);
    
    // Trigger a refresh of the timeline to update bubbles
    const currentDate = selectedDate || new Date().toISOString().slice(0, 10);
    const scope = zoom === "daily" ? "daily" : "full";
    fetch(`/api/timeline?date=${currentDate}&mode=${timelineMode}&scope=${scope}&tz=${encodeURIComponent(timezone)}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((payload) => {
        const wheelItems = [
          ...(payload.allTasks ?? payload.todayTasks ?? []),
          ...(payload.ideas ?? []),
        ];
        hydrateBubbles({
          lifeAreas: payload.areas ?? [],
          workstreams: payload.workstreams ?? [],
          items: wheelItems,
        });
      })
      .catch((error) => {
        console.error("Failed to update zoom:", error);
      });
  };

  return (
    <ScopeZoom
      currentZoom={zoomLevel === "day" ? "daily" : "full"}
      onZoomChange={handleZoomChange}
    />
  );
}

