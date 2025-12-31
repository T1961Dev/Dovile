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
    <div className="flex items-center gap-2 rounded-full border border-[#0EA8A8]/20 bg-white/80 p-1 shadow-sm">
      <Button
        variant="default"
        size="sm"
        onClick={() => onZoomChange("daily")}
        className="h-8 rounded-full px-4 text-xs bg-[#0EA8A8] hover:bg-[#0C8F90] text-white"
      >
        <ZoomIn className="h-3 w-3 mr-1" />
        Today
      </Button>
    </div>
  );
}

