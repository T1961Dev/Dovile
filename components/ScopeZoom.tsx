"use client";

import { ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScopeZoomProps = {
  currentZoom: "daily" | "full";
  onZoomChange: (zoom: "daily" | "full") => void;
};

export function ScopeZoom({ currentZoom, onZoomChange }: ScopeZoomProps) {
  return (
    <Button size="sm" onClick={() => onZoomChange("daily")} className="h-7 w-full text-xs touch-manipulation">
      <ZoomIn className="h-3 w-3 mr-1" />
      Today
    </Button>
  );
}
