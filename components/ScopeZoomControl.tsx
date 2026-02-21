"use client";

import { useBubbleStore } from "@/store/bubbles";
import { useDashboardStore } from "@/store/useDashboardStore";
import { ScopeZoom } from "@/components/ScopeZoom";

type ScopeZoomControlProps = {
  timezone?: string;
};

export function ScopeZoomControl({ timezone = "Europe/London" }: ScopeZoomControlProps) {
  const setZoomLevel = useBubbleStore((state) => state.setZoomLevel);
  const setSelectedDate = useDashboardStore((state) => state.setSelectedDate);

  const handleZoomChange = () => {
    const today = new Date().toISOString().slice(0, 10);
    setSelectedDate(today);
    setZoomLevel("day");
    window.dispatchEvent(new CustomEvent("center-view"));
  };

  return (
    <ScopeZoom
      currentZoom="daily"
      onZoomChange={handleZoomChange}
    />
  );
}

