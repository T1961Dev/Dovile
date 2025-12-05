"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ScopeZoomProps = {
  currentZoom: "daily" | "full";
  onZoomChange: (zoom: "daily" | "full") => void;
};

export function ScopeZoom({ currentZoom, onZoomChange }: ScopeZoomProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      <Button
        variant={currentZoom === "daily" ? "default" : "ghost"}
        size="sm"
        onClick={() => onZoomChange("daily")}
        className="h-8 rounded-full px-3 text-xs"
      >
        <ZoomIn className="h-3 w-3 mr-1" />
        Daily
      </Button>
      <Button
        variant={currentZoom === "full" ? "default" : "ghost"}
        size="sm"
        onClick={() => onZoomChange("full")}
        className="h-8 rounded-full px-3 text-xs"
      >
        <Maximize2 className="h-3 w-3 mr-1" />
        Full Scope
      </Button>
    </div>
  );
}

