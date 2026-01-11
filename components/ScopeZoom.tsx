"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ScopeZoomProps = {
  currentZoom: "daily" | "full";
  onZoomChange: (zoom: "daily" | "full") => void;
};

export function ScopeZoom({ currentZoom, onZoomChange }: ScopeZoomProps) {
  // Only show "Today" button - full scope is always visible from today onwards
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#0EA8A8]/20 bg-white/80 p-0.5 shadow-sm w-full sm:w-auto">
      <Button
        variant="default"
        size="sm"
        onClick={() => onZoomChange("daily")}
        className="h-5 sm:h-6 rounded-full px-2 sm:px-3 text-[9px] sm:text-[10px] bg-[#0EA8A8] hover:bg-[#0C8F90] text-white w-full sm:w-auto touch-manipulation"
      >
        <ZoomIn className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-1" />
        Today
      </Button>
    </div>
  );
}

