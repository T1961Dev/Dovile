"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
        const response = await getLifeAreaRatingsAction(areas.map((a) => a.id));
        setHistory(response);
      } catch (error) {
        console.error(error);
        toast.error("Couldn't load rating history.");
      }
    });
  }, [areas, open]);

  const handleRatingChange = (areaId: string, value: number) => {
    setPendingRatings((prev) => ({ ...prev, [areaId]: value }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await Promise.all(
        Object.entries(pendingRatings).map(([areaId, rating]) => rateLifeAreaAction(areaId, rating)),
      );
      const updatedAreas = areas.map((area) => ({ ...area, rating: pendingRatings[area.id] ?? area.rating }));
      setAreas(updatedAreas);
      Object.entries(pendingRatings).forEach(([areaId, rating]) => {
        const bubble = bubbles[areaId];
        if (bubble && bubble.type === "life_area") {
          upsertBubble({ ...bubble, metadata: { ...bubble.metadata, rating } });
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
      <DialogContent className="grid !max-w-[calc(100vw-1rem)] sm:!max-w-5xl grid-cols-1 gap-4 sm:gap-6 rounded-xl border bg-card p-4 sm:p-6 md:p-8 shadow-lg md:grid-cols-2 max-h-[92vh] sm:max-h-[90vh] overflow-hidden">
        <div className="flex flex-col gap-4 md:col-span-1">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg sm:text-xl font-bold">Wheel of Life</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm mt-1">
              Rate your satisfaction in each life area. How do you feel here today?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 overflow-y-auto pr-1 max-h-[calc(92vh-200px)] sm:max-h-[calc(90vh-220px)]">
            {data.map((area) => (
              <Card key={area.id} className="py-3">
                <CardContent className="space-y-2 px-4 py-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{area.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pendingRatings[area.id] ?? area.rating ?? 5}/10
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(history[area.id]?.[0]?.noted_at ?? "").slice(0, 10) || "—"}
                    </span>
                  </div>
                  <Slider
                    defaultValue={[area.rating ?? 5]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(value) => handleRatingChange(area.id, value[0]!)}
                  />
                  <RatingSparkline history={history[area.id] ?? []} pending={pendingRatings[area.id]} />
                </CardContent>
              </Card>
            ))}
            {loadingHistory && (
              <p className="text-center text-xs text-muted-foreground col-span-2">Loading history…</p>
            )}
          </div>

          <Button onClick={handleSave} disabled={submitting} className="w-full">
            {submitting ? "Saving…" : "Save ratings"}
          </Button>
        </div>

        <div className="md:col-span-1 hidden md:block">
          <RadarChart areas={areas} pendingRatings={pendingRatings} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RatingSparkline({ history, pending }: { history: LifeAreaRating[]; pending?: number }) {
  const entries = pending
    ? [{ rating: pending, noted_at: new Date().toISOString() }, ...history.slice(0, 7)]
    : history.slice(0, 8);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No history yet.</p>;
  }
  const highest = Math.max(...entries.map((e) => e.rating), 10);
  return (
    <div className="flex items-end gap-0.5">
      {entries.slice().reverse().map((entry, i) => (
        <div key={`${entry.noted_at}-${i}`} className="flex flex-col items-center gap-0.5">
          <div className="w-1.5 rounded-full bg-primary/40" style={{ height: `${Math.max(16, (entry.rating / highest) * 40)}px` }} />
          <span className="text-[9px] text-muted-foreground">{entry.rating}</span>
        </div>
      ))}
    </div>
  );
}

function RadarChart({ areas, pendingRatings }: { areas: LifeArea[]; pendingRatings: Record<string, number> }) {
  const radius = 130;
  const points = areas.map((area, index) => {
    const angle = (index / areas.length) * 2 * Math.PI - Math.PI / 2;
    const rating = pendingRatings[area.id] ?? area.rating ?? 5;
    const scaled = (rating / 10) * radius;
    return { x: Math.cos(angle) * scaled + radius, y: Math.sin(angle) * scaled + radius };
  });
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex items-center justify-center rounded-lg border bg-muted p-6">
      <svg width={radius * 2} height={radius * 2}>
        {[2, 4, 6, 8, 10].map((v) => (
          <circle key={v} cx={radius} cy={radius} r={(v / 10) * radius} fill="none" stroke="var(--border)" strokeDasharray="4 6" />
        ))}
        <motion.polygon points={polygonPoints} fill="rgba(14, 168, 168, 0.15)" stroke="var(--primary)" strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        {points.map((point, i) => (
          <motion.circle key={areas[i]!.id} cx={point.x} cy={point.y} r={5} fill={areas[i]!.color} stroke="#fff" strokeWidth={2} />
        ))}
      </svg>
    </div>
  );
}
