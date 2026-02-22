"use client";

import { useTransition } from "react";

import { archiveIdeaAction, convertIdeaToTaskAction } from "@/actions/items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBubbleStore, RING_CONFIG, CANVAS_SIZE, type Bubble } from "@/store/bubbles";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { Item } from "@/types/entities";
import { getTodayISO } from "@/lib/dates";
import { toast } from "sonner";

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
        const existingBubble = bubbleStore.bubbles[idea.id];
        const existingAngle = existingBubble?.bubblePosition?.angle ?? 0;
        const taskAngle = bubbleStore.getNextAngle("task", {
          lifeAreaId: idea.life_area_id ?? undefined,
          parentId: idea.workstream_id ?? undefined,
          anchorAngle: existingAngle,
        });
        const normalized = polarToNormalized(RING_CONFIG.task.radius, taskAngle);
        const updated = await convertIdeaToTaskAction(idea.id, {
          life_area_id: idea.life_area_id,
          workstream_id: idea.workstream_id,
          scheduled_for: selectedDate,
          bubble_position: { ring: RING_CONFIG.task.radius, angle: taskAngle, x: normalized.x, y: normalized.y },
          bubble_size: RING_CONFIG.task.baseSize,
        });
        removeItem(idea.id);
        upsertItem(updated as Item);
        bubbleStore.removeBubble(idea.id);
        const newBubble: Bubble = {
          id: updated.id, type: "task", lifeAreaId: updated.life_area_id ?? undefined, parentId: updated.workstream_id ?? undefined,
          title: updated.title, status: updated.status, bubbleSize: RING_CONFIG.task.baseSize,
          bubblePosition: { ring: RING_CONFIG.task.radius, angle: taskAngle, x: normalized.x, y: normalized.y },
          metadata: { scheduledFor: updated.scheduled_for, notes: updated.notes, __locked: true },
        };
        bubbleStore.upsertBubble(newBubble);
        const addedBubble = bubbleStore.bubbles[updated.id];
        if (addedBubble && !addedBubble.metadata?.__locked) {
          bubbleStore.upsertBubble({ ...addedBubble, metadata: { ...addedBubble.metadata, __locked: true } });
        }
        toast.success("Converted to task");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Couldn't convert");
      }
    });
  };

  const archiveIdea = (idea: Item) => {
    startTransition(async () => {
      try {
        const updated = await archiveIdeaAction(idea.id);
        removeItem(updated.id);
        useBubbleStore.getState().removeBubble(updated.id);
        toast.info("Archived");
      } catch (error) { console.error(error); toast.error("Couldn't archive"); }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full sm:!max-w-md flex-col gap-4 bg-background p-4 sm:p-6">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">Dump Mode</SheetTitle>
          <SheetDescription>
            Dump any idea — AI will assign it to the correct life area. Convert to tasks or archive later.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {ideas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground mb-1">All clear!</p>
              <p className="text-xs text-muted-foreground">Drop new ideas here from the coach</p>
            </div>
          ) : (
            ideas.map((idea) => (
              <Card key={idea.id} className="py-3">
                <CardContent className="space-y-3 px-4 py-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{idea.title}</p>
                      {idea.notes && <p className="mt-0.5 text-xs text-muted-foreground">{idea.notes}</p>}
                    </div>
                    <Badge variant="secondary">Idea</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={pending} onClick={() => convertIdea(idea)} className="h-7 text-xs">
                      Convert to task
                    </Button>
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => archiveIdea(idea)} className="h-7 text-xs">
                      Archive
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
