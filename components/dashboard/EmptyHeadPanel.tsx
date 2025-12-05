"use client";

import { useTransition, useState, useRef, useEffect } from "react";

import { archiveIdeaAction, convertIdeaToTaskAction } from "@/actions/items";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBubbleStore, RING_CONFIG, type Bubble } from "@/store/bubbles";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { Item } from "@/types/entities";
import { getTodayISO } from "@/lib/dates";
import { toast } from "sonner";

const CANVAS_SIZE = 640;
const polarToNormalized = (radius: number, angle: number) => ({
  x: (Math.cos(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
  y: (Math.sin(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
});

export function EmptyHeadPanel() {
  const open = useDashboardStore((state) => state.emptyHeadOpen);
  const setOpen = useDashboardStore((state) => state.setEmptyHeadOpen);
  const ideas = useDashboardStore((state) => state.ideas);
  const upsertItem = useDashboardStore((state) => state.upsertItem);
  const removeItem = useDashboardStore((state) => state.removeItem);
  const [pending, startTransition] = useTransition();

  const convertIdea = (idea: Item) => {
    startTransition(async () => {
      try {
        const bubbleStore = useBubbleStore.getState();
        const selectedDate = useDashboardStore.getState().selectedDate || getTodayISO();
        
        // Get the existing bubble's position if it exists
        const existingBubble = bubbleStore.bubbles[idea.id];
        const existingAngle = existingBubble?.bubblePosition?.angle ?? 0;
        
        // Calculate proper angle for the task
        const taskAngle = bubbleStore.getNextAngle("task", {
          lifeAreaId: idea.life_area_id ?? undefined,
          parentId: idea.workstream_id ?? undefined,
          anchorAngle: existingAngle,
        });
        
        // Convert to normalized coordinates
        const normalized = polarToNormalized(RING_CONFIG.task.radius, taskAngle);
        
        // Convert idea to task and schedule it for today
        const updated = await convertIdeaToTaskAction(idea.id, {
          life_area_id: idea.life_area_id,
          workstream_id: idea.workstream_id,
          scheduled_for: selectedDate, // Schedule for today so it appears in daily mode
          bubble_position: {
            ring: RING_CONFIG.task.radius,
            angle: taskAngle,
            x: normalized.x,
            y: normalized.y,
          },
          bubble_size: RING_CONFIG.task.baseSize,
        });
        
        removeItem(idea.id);
        upsertItem(updated as Item);
        
        // Remove old idea bubble
        bubbleStore.removeBubble(idea.id);
        
        // Add new task bubble with __locked flag to prevent it from disappearing
        const newBubble: Bubble = {
            id: updated.id,
            type: "task",
            lifeAreaId: updated.life_area_id ?? undefined,
            parentId: updated.workstream_id ?? undefined,
            title: updated.title,
            status: updated.status,
            bubbleSize: RING_CONFIG.task.baseSize,
            bubblePosition: {
              ring: RING_CONFIG.task.radius,
            angle: taskAngle,
            x: normalized.x,
            y: normalized.y,
            },
            metadata: {
              scheduledFor: updated.scheduled_for,
              notes: updated.notes,
            __locked: true, // CRITICAL: Lock it so it doesn't disappear during hydration
          },
        };
        
        bubbleStore.upsertBubble(newBubble);
        
        // Double-check it's locked
        const addedBubble = bubbleStore.bubbles[updated.id];
        if (addedBubble && !addedBubble.metadata?.__locked) {
          bubbleStore.upsertBubble({
            ...addedBubble,
            metadata: {
              ...addedBubble.metadata,
              __locked: true,
            },
          });
        }
        
        toast.success("Converted to a task.");
      } catch (error) {
        console.error(error);
        toast.error("Couldn't convert this idea.");
      }
    });
  };

  const archiveIdea = (idea: Item) => {
    startTransition(async () => {
      try {
        const updated = await archiveIdeaAction(idea.id);
        removeItem(updated.id);
        useBubbleStore.getState().removeBubble(updated.id);
        toast.info("Idea moved to archive.");
      } catch (error) {
        console.error(error);
        toast.error("Couldn't archive this idea.");
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col gap-6 border-l border-[#0EA8A8]/20 bg-[#FDFBF6] p-8 text-[#0B1918]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl font-semibold">DUMP MODE</SheetTitle>
          <SheetDescription className="text-xs text-[#195552]">
            Dump any small item - AI will automatically assign it to the correct life area and project/process as an IDEA. You can later drag/drop ideas into specific projects or convert them to actions.
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex-1 space-y-4 overflow-y-auto pr-1"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("bg-[#D6FFF3]/30");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("bg-[#D6FFF3]/30");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("bg-[#D6FFF3]/30");
            const bubbleId = e.dataTransfer.getData("bubbleId");
            if (bubbleId) {
              const ideas = useDashboardStore.getState().ideas;
              const idea = ideas.find((i) => i.id === bubbleId);
              if (idea) {
                toast.info(`Idea "${idea.title}" is already in your list`);
              }
            }
          }}
        >
          {ideas.length === 0 ? (
            <div className="text-center py-8 rounded-2xl border-2 border-dashed border-[#0EA8A8]/30 bg-[#D6FFF3]/10">
              <p className="text-sm text-[#195552] mb-2">
                All clear! Drop new ideas here from the coach
              </p>
              <p className="text-xs text-[#195552]/70">
                Or drag idea bubbles from the circle to park them here
              </p>
            </div>
          ) : (
            ideas.map((idea) => (
              <article
                key={idea.id}
                className="rounded-3xl border border-[#0EA8A8]/15 bg-white p-4 shadow-sm"
              >
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#0B1918]">{idea.title}</h3>
                    {idea.notes ? (
                      <p className="mt-1 text-xs text-[#195552]">{idea.notes}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-[#D6FFF3]/70 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[#0EA8A8]">
                    Idea
                  </span>
                </header>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => convertIdea(idea)}
                    className="h-8 rounded-full bg-[#0EA8A8] px-4 text-xs font-semibold text-white hover:bg-[#0C8F90]"
                  >
                    Convert to task
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => archiveIdea(idea)}
                    className="h-8 rounded-full border-[#FF7348]/40 bg-white px-4 text-xs font-semibold text-[#FF7348] hover:border-[#FF7348]/60"
                  >
                    Archive
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}


