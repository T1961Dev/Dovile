"use client";

import { useMemo, useState, useTransition } from "react";

import { decomposeVisionAction } from "@/actions/ai/decompose";
import { approveVisionStepsAction } from "@/actions/visions";
import { updateItemAction } from "@/actions/items";
import { updateWorkstreamAction } from "@/actions/workstreams";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBubbleStore, RING_CONFIG } from "@/store/bubbles";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { Item, Workstream } from "@/types/entities";
import { toast } from "sonner";

const CANVAS_SIZE = 640;
const polarToNormalized = (radius: number, angle: number) => ({
  x: (Math.cos(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
  y: (Math.sin(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
});

type DraftStep = {
  id: string;
  title: string;
  notes: string | null;
  bubbleType: "task" | "idea";
};

export function PlannerOverlay() {
  const open = useDashboardStore((state) => state.plannerOpen);
  const setOpen = useDashboardStore((state) => state.setPlannerOpen);
  const lifeAreas = useDashboardStore((state) => state.areas);
  const setWorkstreams = useDashboardStore((state) => state.setWorkstreams);
  const workstreams = useDashboardStore((state) => state.workstreams);
  const upsertItem = useDashboardStore((state) => state.upsertItem);
  const [title, setTitle] = useState("");
  const [timeframe, setTimeframe] = useState("This quarter");
  const [description, setDescription] = useState("");
  const [lifeAreaId, setLifeAreaId] = useState<string | undefined>(undefined);
  const [targetDate, setTargetDate] = useState("");
  const [draftVision, setDraftVision] = useState<{
    visionId: string;
    steps: DraftStep[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const areaOptions = useMemo(
    () =>
      lifeAreas.map((area) => ({
        value: area.id,
        label: area.name,
      })),
    [lifeAreas],
  );

  const resetForm = () => {
    setTitle("");
    setTimeframe("This quarter");
    setDescription("");
    setLifeAreaId(undefined);
    setTargetDate("");
    setDraftVision(null);
  };

  const handleGenerate = () => {
    if (!description.trim() || !title.trim()) {
      toast.error("Add a title and description so I can break it down.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await decomposeVisionAction({
          title,
          timeframe,
          description,
          lifeAreaId,
          targetDate: targetDate || undefined,
        });
        const steps = (result.steps ?? []).map((step) => {
          const payload = step.bubble_payload as Record<string, unknown>;
          return {
            id: step.id,
            title: String(payload.title ?? "Untitled"),
            notes: (payload.notes as string | null) ?? null,
            bubbleType: (payload.type as "task" | "idea") ?? "task",
          };
        });
        setDraftVision({ visionId: result.vision.id, steps });
        toast.success("Plan drafted — review the tasks below.");
      } catch (error) {
        console.error(error);
        toast.error("Couldn't generate a plan right now.");
      }
    });
  };

  const handleApprove = () => {
    if (!draftVision) return;
    startTransition(async () => {
      try {
        const result = await approveVisionStepsAction({
          visionId: draftVision.visionId,
          steps: draftVision.steps.map((step) => ({
            stepId: step.id,
            bubbleType: step.bubbleType,
            lifeAreaId: lifeAreaId,
          })),
        });

        const bubbleStore = useBubbleStore.getState();
        const itemUpdates: Promise<unknown>[] = [];
        for (const item of result.createdItems) {
          const bubbleType = item.type === "task" ? "task" : "idea";
          const ring = RING_CONFIG[bubbleType];
          const angle = bubbleStore.getNextAngle(bubbleType, {
            lifeAreaId: item.life_area_id ?? undefined,
            parentId: item.workstream_id ?? undefined,
          });
          const normalized = polarToNormalized(ring.radius, angle);

          upsertItem(item as Item);
          bubbleStore.upsertBubble({
            id: item.id,
            type: bubbleType,
            lifeAreaId: item.life_area_id ?? undefined,
            parentId: item.workstream_id ?? undefined,
            title: item.title,
            status: item.status,
            bubbleSize: ring.baseSize,
            bubblePosition: {
              ring: ring.radius,
              angle,
              x: normalized.x,
              y: normalized.y,
            },
            metadata: {
              scheduledFor: item.scheduled_for,
              notes: item.notes,
            },
          });
          bubbleStore.updateBubblePosition(item.id, {
            ring: ring.radius,
            angle,
            x: normalized.x,
            y: normalized.y,
          });
          itemUpdates.push(
            updateItemAction(item.id, {
              bubble_position: { ring: ring.radius, angle, x: normalized.x, y: normalized.y },
              bubble_size: ring.baseSize,
            } as any),
          );
        }

        const workstreamUpdates: Promise<unknown>[] = [];
        if (result.createdWorkstreams.length > 0) {
          const merged: Workstream[] = [
            ...workstreams.filter(
              (stream) => !result.createdWorkstreams.some((created) => created.id === stream.id),
            ),
            ...(result.createdWorkstreams as Workstream[]),
          ];
          setWorkstreams(merged);

          for (const stream of result.createdWorkstreams) {
            const bubbleType = stream.kind === "process" ? "process" : "project";
            const ring = RING_CONFIG[bubbleType];
            const angle = bubbleStore.getNextAngle(bubbleType, {
              lifeAreaId: stream.life_area_id ?? undefined,
            });
            const normalized = polarToNormalized(ring.radius, angle);

            bubbleStore.upsertBubble({
              id: stream.id,
              type: bubbleType,
              lifeAreaId: stream.life_area_id ?? undefined,
              title: stream.title,
              status: stream.active ? "active" : "archived",
              bubbleSize: ring.baseSize,
              bubblePosition: {
                ring: ring.radius,
                angle,
                x: normalized.x,
                y: normalized.y,
              },
              metadata: {
                description: stream.description,
                kind: stream.kind,
              },
            });
            bubbleStore.updateBubblePosition(stream.id, {
              ring: ring.radius,
              angle,
              x: normalized.x,
              y: normalized.y,
            });
            workstreamUpdates.push(
              updateWorkstreamAction(stream.id, {
                bubble_position: { ring: ring.radius, angle, x: normalized.x, y: normalized.y },
                bubble_size: ring.baseSize,
              } as any),
            );
          }
        }

        await Promise.all([...itemUpdates, ...workstreamUpdates]);

        result.createdItems.forEach((item) => {
          useBubbleStore.getState().forgetLocalPosition(item.id);
        });
        result.createdWorkstreams.forEach((stream) => {
          useBubbleStore.getState().forgetLocalPosition(stream.id);
        });

        toast.success("Plan added to your scope.");
        resetForm();
        setOpen(false);
      } catch (error) {
        console.error(error);
        toast.error("Couldn't apply this plan.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
        }
        setOpen(next);
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[min(90vw,720px)] flex-col overflow-hidden rounded-3xl border border-[#0EA8A8]/25 bg-[#FDFBF6] text-[#0B1918] shadow-[0_40px_65px_-35px_rgba(14,168,168,0.35)]">
        <DialogHeader className="px-8 pt-8 text-left">
          <DialogTitle className="text-xl font-semibold">PLANNER MODE</DialogTitle>
          <DialogDescription className="text-xs text-[#195552]">
            Describe your vision, goal, or plan. I'll break it down into actionable, one-sit tasks with clear Definitions of Done that you can approve and add to your circle.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-8 pb-6 pr-10">
          <Input
            placeholder="Name your vision"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-full border-[#0EA8A8]/20 bg-white"
          />
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="rounded-full border-[#0EA8A8]/20 bg-white text-sm">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="This quarter">This quarter</SelectItem>
              <SelectItem value="This year">This year</SelectItem>
              <SelectItem value="3 years">3 years</SelectItem>
              <SelectItem value="10 year vision">10 year vision</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Describe what success looks like..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-[140px] rounded-2xl border-[#0EA8A8]/20 bg-white text-sm"
          />

          <div className="flex gap-2">
            <Select value={lifeAreaId} onValueChange={setLifeAreaId}>
              <SelectTrigger className="rounded-full border-[#0EA8A8]/20 bg-white text-sm">
                <SelectValue placeholder="Attach to life area (optional)" />
              </SelectTrigger>
              <SelectContent>
                {areaOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="rounded-full border-[#0EA8A8]/20 bg-white text-sm"
            />
          </div>

          <Button
            disabled={pending}
            onClick={handleGenerate}
            className="w-full rounded-full bg-[#0EA8A8] text-sm font-semibold text-white hover:bg-[#0C8F90]"
          >
            {pending ? "Thinking…" : "Generate plan"}
          </Button>
          {draftVision ? (
            <div className="space-y-3 rounded-3xl border border-[#0EA8A8]/20 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0B1918]">Suggested actionable tasks</h3>
              <p className="text-xs text-[#195552] mb-3">
                Each task is designed to be completed in one focused session with a clear Definition of Done.
              </p>
              <div className="flex flex-col gap-2">
                {draftVision.steps.length === 0 ? (
                  <p className="text-xs text-[#195552]">
                    No tasks came back. Try adding more detail to your description.
                  </p>
                ) : (
                  draftVision.steps.map((step) => (
                    <div
                      key={step.id}
                      className="rounded-2xl border border-[#0EA8A8]/10 bg-[#FDFBF6] px-3 py-2 text-sm text-[#0B1918]"
                    >
                      <p className="font-medium">{step.title}</p>
                      {step.notes ? (
                        <p className="text-xs text-[#195552] mt-1">{step.notes}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-row justify-end gap-3 px-8 pb-8 pt-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-[#0EA8A8]/30 px-6 text-sm font-semibold text-[#0EA8A8] hover:border-[#0EA8A8]/60"
            onClick={() => {
              resetForm();
              setOpen(false);
            }}
          >
            Close
          </Button>
          <Button
            type="button"
            disabled={pending || !draftVision || draftVision.steps.length === 0}
            onClick={handleApprove}
            className="rounded-full bg-[#FFD833] px-6 text-sm font-semibold text-[#0B1918] hover:bg-[#FECB32]"
          >
            Add to circle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


