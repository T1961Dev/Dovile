"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useBubbleStore } from "@/store/bubbles";
import type { LifeArea, LifeAreaRating } from "@/types/entities";
import { getLifeAreaRatingsAction, rateLifeAreaAction } from "@/actions/life-areas";
import { toast } from "sonner";

export function WheelOfLifeOverlay() {
  const open = useDashboardStore((state) => state.wheelOverlayOpen);
  const setOpen = useDashboardStore((state) => state.setWheelOverlayOpen);
  const areas = useDashboardStore((state) => state.areas);
  const setAreas = useDashboardStore((state) => state.setAreas);
  const upsertBubble = useBubbleStore((state) => state.upsertBubble);
  const bubbles = useBubbleStore((state) => state.bubbles);
  const [pendingRatings, setPendingRatings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Record<string, LifeAreaRating[]>>({});
  const [loadingHistory, startHistoryTransition] = useTransition();

  const data = useMemo(() => areas ?? [], [areas]);

  useEffect(() => {
    if (!open || !areas.length) return;
    startHistoryTransition(async () => {
      try {
        const response = await getLifeAreaRatingsAction(areas.map((area) => area.id));
        setHistory(response);
      } catch (error) {
        console.error(error);
        toast.error("Couldn't load rating history.");
      }
    });
  }, [areas, open]);

  const handleRatingChange = (areaId: string, value: number) => {
    setPendingRatings((prev) => ({
      ...prev,
      [areaId]: value,
    }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await Promise.all(
        Object.entries(pendingRatings).map(([areaId, rating]) =>
          rateLifeAreaAction(areaId, rating),
        ),
      );
      const updatedAreas = areas.map((area) => ({
        ...area,
        rating: pendingRatings[area.id] ?? area.rating,
      }));
      setAreas(updatedAreas);
      
      // Update bubble store with new ratings
      Object.entries(pendingRatings).forEach(([areaId, rating]) => {
        const bubble = bubbles[areaId];
        if (bubble && bubble.type === "life_area") {
          upsertBubble({
            ...bubble,
            metadata: {
              ...bubble.metadata,
              rating,
            },
          });
        }
      });
      
      toast.success("Ratings updated.");
      setPendingRatings({});
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="grid max-w-4xl grid-cols-1 gap-8 rounded-3xl border border-slate-100 bg-white p-10 shadow-2xl md:grid-cols-2">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold text-slate-900">
            Wheel of Life
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          {data.map((area) => (
            <div key={area.id} className="space-y-3 rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-800">{area.name}</span>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#0EA8A8]">
                    Current {pendingRatings[area.id] ?? area.rating}/10
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {(history[area.id]?.[0]?.noted_at ?? "").slice(0, 10) || "—"}
                </span>
              </div>
              <Slider
                defaultValue={[area.rating]}
                min={1}
                max={10}
                step={1}
                onValueChange={(value) => handleRatingChange(area.id, value[0]!)}
              />
              <RatingSparkline history={history[area.id] ?? []} pending={pendingRatings[area.id]} />
            </div>
          ))}
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-[#0EA8A8] text-white hover:bg-[#0C8F90]"
          >
            {submitting ? "Saving…" : "Save ratings"}
          </Button>
          {loadingHistory ? (
            <p className="text-center text-xs text-slate-400">Loading history…</p>
          ) : null}
        </div>
        <RadarChart areas={areas} pendingRatings={pendingRatings} />
      </DialogContent>
    </Dialog>
  );
}

function RatingSparkline({
  history,
  pending,
}: {
  history: LifeAreaRating[];
  pending?: number;
}) {
  const entries = pending
    ? [{ rating: pending, noted_at: new Date().toISOString() }, ...history.slice(0, 7)]
    : history.slice(0, 8);
  if (entries.length === 0) {
    return <p className="text-[11px] text-slate-500">No rating history yet.</p>;
  }

  const highest = Math.max(...entries.map((entry) => entry.rating), 10);

  return (
    <div className="flex items-center gap-1">
      {entries
        .slice()
        .reverse()
        .map((entry, index) => (
          <div key={`${entry.noted_at}-${index}`} className="flex flex-col items-center gap-1">
            <div
              className="w-2 rounded-full bg-[#0EA8A8]/50"
              style={{
                height: `${Math.max(28, (entry.rating / highest) * 60)}px`,
              }}
            />
            <span className="text-[10px] text-slate-400">{entry.rating}</span>
          </div>
        ))}
    </div>
  );
}

function RadarChart({
  areas,
  pendingRatings,
}: {
  areas: LifeArea[];
  pendingRatings: Record<string, number>;
}) {
  const radius = 140;
  const points = areas.map((area, index) => {
    const angle = (index / areas.length) * 2 * Math.PI - Math.PI / 2;
    const rating = pendingRatings[area.id] ?? area.rating;
    const scaled = (rating / 10) * radius;
    return {
      x: Math.cos(angle) * scaled + radius,
      y: Math.sin(angle) * scaled + radius,
    };
  });

  const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="flex items-center justify-center rounded-3xl border border-slate-100 bg-slate-50 p-6">
      <svg width={radius * 2} height={radius * 2}>
        {[2, 4, 6, 8, 10].map((value) => (
          <circle
            key={value}
            cx={radius}
            cy={radius}
            r={(value / 10) * radius}
            fill="none"
            stroke="#CBD5F5"
            strokeDasharray="4 6"
          />
        ))}
        <motion.polygon
          points={polygonPoints}
          fill="rgba(37, 99, 235, 0.2)"
          stroke="#2563EB"
          strokeWidth={2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        {points.map((point, index) => (
          <motion.circle
            key={areas[index]!.id}
            cx={point.x}
            cy={point.y}
            r={6}
            fill={areas[index]!.color}
            stroke="#ffffff"
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}

