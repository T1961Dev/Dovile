"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO, startOfDay, subYears } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useBubbleStore } from "@/store/bubbles";
import type { Item } from "@/types/entities";
import { getTodayISO } from "@/lib/dates";

type TimePerspective = "today" | "week" | "month" | "quarter" | "year" | "decade";

export function CurrentScopeView() {
  const open = useDashboardStore((state) => state.currentScopeOpen);
  const setOpen = useDashboardStore((state) => state.setCurrentScopeOpen);
  const tasks = useDashboardStore((state) => state.tasks);
  const ideas = useDashboardStore((state) => state.ideas);
  const workstreams = useDashboardStore((state) => state.workstreams);
  const areas = useDashboardStore((state) => state.areas);
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const [perspective, setPerspective] = useState<TimePerspective>("today");

  const allItems = useMemo(() => {
    const combined: Array<Item & { typeLabel: string }> = [
      ...tasks.map((t) => ({ ...t, typeLabel: "Task" })),
      ...ideas.map((i) => ({ ...i, typeLabel: "Idea" })),
    ];
    return combined.sort((a, b) => {
      const dateA = a.scheduled_for ? parseISO(a.scheduled_for).getTime() : 0;
      const dateB = b.scheduled_for ? parseISO(b.scheduled_for).getTime() : 0;
      return dateB - dateA;
    });
  }, [tasks, ideas]);

  const filteredItems = useMemo(() => {
    const today = selectedDate || getTodayISO();
    const baseDate = parseISO(today);
    const now = Date.now();

    return allItems.filter((item) => {
      if (!item.scheduled_for) return perspective === "decade" || perspective === "year";
      const itemDate = parseISO(item.scheduled_for).getTime();
      const daysDiff = (itemDate - baseDate.getTime()) / (1000 * 60 * 60 * 24);

      switch (perspective) {
        case "today":
          return daysDiff === 0;
        case "week":
          return daysDiff >= 0 && daysDiff <= 7;
        case "month":
          return daysDiff >= 0 && daysDiff <= 30;
        case "quarter":
          return daysDiff >= 0 && daysDiff <= 90;
        case "year":
          return daysDiff >= 0 && daysDiff <= 365;
        case "decade":
          return itemDate <= now + 10 * 365 * 24 * 60 * 60 * 1000;
        default:
          return true;
      }
    });
  }, [allItems, perspective, selectedDate]);

  const perspectiveLabels: Record<TimePerspective, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    quarter: "This Quarter",
    year: "This Year",
    decade: "10-Year Vision",
  };

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-6 rounded-3xl border border-[#0EA8A8]/15 bg-[#FDFBF6] p-8">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold text-[#0B1918]">
            Current Scope of My Life
          </DialogTitle>
          <DialogDescription className="text-sm text-[#195552]">
            Full list of all your ideas and tasks. Roll back through time perspectives to see your complete scope.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {(["today", "week", "month", "quarter", "year", "decade"] as TimePerspective[]).map((p) => (
            <Button
              key={p}
              variant={perspective === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPerspective(p)}
              className={
                perspective === p
                  ? "rounded-full bg-[#0EA8A8] text-white"
                  : "rounded-full border-[#0EA8A8]/30 text-[#0EA8A8] hover:bg-[#0EA8A8]/10"
              }
            >
              {perspectiveLabels[p]}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[#195552]">
                No items in this time perspective. Try expanding your view.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const area = areas.find((a) => a.id === item.life_area_id);
              const workstream = workstreams.find((w) => w.id === item.workstream_id);
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[#0EA8A8]/15 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                            item.type === "task"
                              ? "bg-[#F4B13E]/20 text-[#F4B13E]"
                              : "bg-[#8F8CF5]/20 text-[#8F8CF5]"
                          }`}
                        >
                          {item.typeLabel}
                        </span>
                        {area && (
                          <span className="text-xs text-[#195552]">
                            {area.name}
                          </span>
                        )}
                        {workstream && (
                          <span className="text-xs text-[#195552]/70">
                            → {workstream.title}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-[#0B1918] mb-1">
                        {item.title}
                      </h3>
                      {item.notes && (
                        <p className="text-xs text-[#195552] mt-1">
                          {item.notes}
                        </p>
                      )}
                      {item.scheduled_for && (
                        <p className="text-[10px] text-[#195552]/70 mt-2">
                          Scheduled: {format(parseISO(item.scheduled_for), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-medium ${
                          item.status === "done"
                            ? "text-[#0EA8A8]"
                            : item.status === "in_progress"
                              ? "text-[#FFD833]"
                              : item.status === "pending"
                                ? "text-[#F4B13E]"
                                : "text-[#195552]/60"
                        }`}
                      >
                        {item.status === "in_progress" ? "In Progress" : item.status === "done" ? "Done" : item.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="pt-4 border-t border-[#0EA8A8]/10">
          <p className="text-xs text-center text-[#195552]">
            Showing {filteredItems.length} of {allItems.length} total items
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

