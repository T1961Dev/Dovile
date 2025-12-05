"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createWorkstreamAction, updateWorkstreamAction } from "@/actions/workstreams";
import { createItemAction, updateItemAction, startTaskAction, completeItemAction, getItemAction } from "@/actions/items";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { Item, Workstream } from "@/types/entities";
import { useBubbleStore, RING_CONFIG, type Bubble } from "@/store/bubbles";
import { getTodayISO } from "@/lib/dates";
import { toast } from "sonner";

const CANVAS_SIZE = 640;

const polarToNormalized = (radius: number, angle: number) => ({
  x: (Math.cos(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
  y: (Math.sin(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
});

type TabKey = "projects" | "processes" | "habits" | "items";

export function AreaSheet() {
  const openAreaId = useDashboardStore((state) => state.areaSheetOpen);
  const selectedBubbleId = useDashboardStore((state) => state.selectedBubbleId);
  const selectedBubbleType = useDashboardStore((state) => state.selectedBubbleType);
  const closeBubbleSheet = useDashboardStore((state) => state.closeBubbleSheet);
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const areas = useDashboardStore((state) => state.areas);
  const workstreams = useDashboardStore((state) => state.workstreams);
  const tasks = useDashboardStore((state) => state.tasks);
  const ideas = useDashboardStore((state) => state.ideas);
  const setWorkstreams = useDashboardStore((state) => state.setWorkstreams);
  const upsertItem = useDashboardStore((state) => state.upsertItem);
  const upsertBubble = useBubbleStore((state) => state.upsertBubble);
  const updateBubblePosition = useBubbleStore((state) => state.updateBubblePosition);
  const getNextAngle = useBubbleStore((state) => state.getNextAngle);

  const bubbles = useBubbleStore((state) => state.bubbles);
  const selectedBubble = selectedBubbleId ? bubbles[selectedBubbleId] : null;
  const [fetchedItem, setFetchedItem] = useState<Item | null>(null);
  const [isLoadingItem, setIsLoadingItem] = useState(false);
  
  // Get the area/project/task/idea based on bubble type
  const area = selectedBubbleType === "life_area" ? areas.find((entry) => entry.id === selectedBubbleId) : null;
  const project = (selectedBubbleType === "project" || selectedBubbleType === "process") ? workstreams.find((w) => w.id === selectedBubbleId) : null;
  
  // Try to find item in store first, if not found and it's a task/idea, fetch it
  const itemFromStore = (selectedBubbleType === "task" || selectedBubbleType === "idea") 
    ? [...tasks, ...ideas].find((i) => i.id === selectedBubbleId) 
    : null;
  
  const item = itemFromStore || fetchedItem;
  
  // Fetch item if not in store (e.g., completed tasks)
  useEffect(() => {
    if ((selectedBubbleType === "task" || selectedBubbleType === "idea") && selectedBubbleId && !itemFromStore) {
      let cancelled = false;
      setIsLoadingItem(true);
      setFetchedItem(null);
      
      getItemAction(selectedBubbleId)
        .then((item) => {
          if (!cancelled && item) {
            setFetchedItem(item as Item);
            upsertItem(item as Item); // Add to store
          } else if (!cancelled) {
            setFetchedItem(null);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error("Failed to fetch item:", error);
            setFetchedItem(null);
            toast.error("Failed to load task details");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingItem(false);
          }
        });
      
      return () => {
        cancelled = true;
        setIsLoadingItem(false);
      };
    } else if (itemFromStore) {
      // Clear fetched item if we now have it in store
      setFetchedItem(null);
      setIsLoadingItem(false);
    } else {
      setIsLoadingItem(false);
    }
  }, [selectedBubbleId, selectedBubbleType, itemFromStore, upsertItem]);
  const [activeTab, setActiveTab] = useState<TabKey>("projects");
  const [workstreamTitle, setWorkstreamTitle] = useState("");
  const [workstreamDescription, setWorkstreamDescription] = useState("");
  const [creatingWorkstream, setCreatingWorkstream] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");
  const [itemType, setItemType] = useState<"task" | "idea">("idea");
  const [submittingItem, setSubmittingItem] = useState(false);

  const filteredWorkstreams = useMemo(() => {
    if (selectedBubbleType === "life_area" && selectedBubbleId) {
      return workstreams.filter((stream) => stream.life_area_id === selectedBubbleId);
    }
    return [];
  }, [selectedBubbleType, selectedBubbleId, workstreams]);

  const areaItems = useMemo(() => {
    if (selectedBubbleType === "life_area" && selectedBubbleId) {
      return [...tasks, ...ideas].filter((item) => item.life_area_id === selectedBubbleId);
    }
    if ((selectedBubbleType === "project" || selectedBubbleType === "process") && selectedBubbleId) {
      return [...tasks, ...ideas].filter((item) => item.workstream_id === selectedBubbleId);
    }
    return [];
  }, [ideas, selectedBubbleType, selectedBubbleId, tasks]);

  const handleCreateWorkstream = async () => {
    if (selectedBubbleType !== "life_area" || !selectedBubbleId || !workstreamTitle.trim()) return;
    const targetArea = areas.find((a) => a.id === selectedBubbleId);
    if (!targetArea) return;
    setCreatingWorkstream(true);
    try {
      const created = await createWorkstreamAction({
        lifeAreaId: targetArea.id,
        title: workstreamTitle,
        description: workstreamDescription,
        kind: mapTabToKind(activeTab),
      });
      const nextList = [
        ...workstreams.filter((stream) => stream.id !== created.id),
        created as Workstream,
      ];
      setWorkstreams(nextList);

      const bubbleType = created.kind === "process" ? "process" : "project";
      const slotAngle = getNextAngle(bubbleType, {
        lifeAreaId: targetArea.id,
      });
      const config = RING_CONFIG[bubbleType];
      const normalized = polarToNormalized(config.radius, slotAngle);
      upsertBubble({
        id: created.id,
        type: bubbleType,
        lifeAreaId: targetArea.id,
        title: created.title,
        status: created.active ? "active" : "archived",
        bubbleSize: config.baseSize,
        bubblePosition: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y },
        metadata: {
          description: created.description,
          kind: created.kind,
        },
      });
      updateBubblePosition(created.id, { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y });
      await updateWorkstreamAction(created.id, {
        bubble_position: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y },
        bubble_size: config.baseSize,
      } as any);
      useBubbleStore.getState().forgetLocalPosition(created.id);
      setWorkstreamTitle("");
      setWorkstreamDescription("");
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingWorkstream(false);
    }
  };

  const handleCreateItem = async () => {
    if (!selectedBubbleId || !newItemTitle.trim()) return;
    
    let lifeAreaId: string | undefined;
    let workstreamId: string | undefined;
    
    if (selectedBubbleType === "life_area") {
      lifeAreaId = selectedBubbleId;
    } else if (selectedBubbleType === "project" || selectedBubbleType === "process") {
      workstreamId = selectedBubbleId;
      const workstream = workstreams.find((w) => w.id === selectedBubbleId);
      lifeAreaId = workstream?.life_area_id ?? undefined;
    } else {
      return; // Can't add items to items
    }
    
    if (!lifeAreaId) {
      return; // Life area ID is required
    }
    
    setSubmittingItem(true);
    try {
      // For tasks, set scheduled_for to today's date so they appear in todayTasks
      const today = selectedDate || getTodayISO();
      const scheduledFor = itemType === "task" ? today : null;
      
      const created = await createItemAction({
        life_area_id: lifeAreaId,
        workstream_id: workstreamId,
        title: newItemTitle,
        notes: newItemNotes || null,
        type: itemType,
        status: "pending",
        scheduled_for: scheduledFor,
      } as any);
      const bubbleType = itemType === "task" ? "task" : "idea";
      const config = RING_CONFIG[bubbleType];
      const slotAngle = getNextAngle(bubbleType, {
        lifeAreaId,
        parentId: workstreamId,
      });
      const normalized = polarToNormalized(config.radius, slotAngle);
      const updated = await updateItemAction(created.id, {
        bubble_position: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y },
        bubble_size: config.baseSize,
      } as any);
      
      // Add to dashboard store
      upsertItem(updated as Item);
      
      // Add to bubble store with proper position - ensure it has x, y coordinates
      const newBubble: Bubble = {
        id: updated.id,
        type: bubbleType,
        lifeAreaId,
        parentId: workstreamId ?? undefined,
        title: updated.title,
        status: updated.status,
        bubbleSize: config.baseSize,
        bubblePosition: {
          ring: config.radius,
          angle: slotAngle,
          x: normalized.x,
          y: normalized.y,
        },
        metadata: {
          scheduledFor: updated.scheduled_for,
          notes: updated.notes,
          __locked: true,
        },
      };
      
      // Add to bubble store with __locked flag to prevent repositioning and preserve during hydration
      upsertBubble(newBubble);
      
      // Update position to ensure it's locked and persists
      updateBubblePosition(updated.id, { 
        ring: config.radius, 
        angle: slotAngle, 
        x: normalized.x, 
        y: normalized.y 
      });
      
      // Force update the bubble with __locked flag to ensure it persists through hydration
      const bubbleStore = useBubbleStore.getState();
      const currentBubble = bubbleStore.bubbles[updated.id];
      if (currentBubble && !currentBubble.metadata?.__locked) {
        bubbleStore.upsertBubble({
          ...currentBubble,
          metadata: {
            ...currentBubble.metadata,
            __locked: true,
          },
        });
      }
      
      // Verify the bubble was added correctly
      const addedBubble = bubbleStore.bubbles[updated.id];
      if (!addedBubble) {
        console.error("Bubble was not added to store", updated.id);
        toast.error("Task created but not visible. Try refreshing.");
      } else if (!addedBubble.metadata?.__locked) {
        console.warn("Bubble was added but __locked is not set", updated.id);
        // Force set it
        bubbleStore.upsertBubble({
          ...addedBubble,
          metadata: {
            ...addedBubble.metadata,
            __locked: true,
          },
        });
      }
      
      toast.success(`${itemType === "task" ? "Task" : "Idea"} added successfully`);
      setNewItemTitle("");
      setNewItemNotes("");
    } catch (error) {
      console.error(error);
      toast.error(`Failed to create ${itemType}`);
    } finally {
      setSubmittingItem(false);
    }
  };

  const isOpen = Boolean(selectedBubbleId && selectedBubble);
  const displayTitle = area?.name || project?.title || item?.title || "";
  const displayColor = area?.color || (selectedBubble?.type === "project" ? "#28B7A3" : selectedBubble?.type === "process" ? "#FF8F5A" : selectedBubble?.type === "task" ? "#F4B13E" : selectedBubble?.type === "idea" ? "#8F8CF5" : "#0EA8A8");

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && closeBubbleSheet()}>
      <SheetContent side="right" className="flex w-full max-w-xl flex-col gap-6 bg-[#FDFBF6] p-8">
        {selectedBubble ? (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-3 text-2xl font-semibold text-[#0B1918]">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: displayColor }}
                />
                {displayTitle}
              </SheetTitle>
              {selectedBubble.metadata?.description ? (
                <p className="mt-2 text-sm text-[#195552]">
                  {String(selectedBubble.metadata.description)}
                </p>
              ) : null}
              {selectedBubble.metadata?.notes && item ? (
                <p className="mt-2 text-xs text-[#195552]/80">
                  {String(selectedBubble.metadata.notes)}
                </p>
              ) : null}
            </SheetHeader>

            {selectedBubbleType === "life_area" && (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
                <TabsList className="grid w-full grid-cols-4 rounded-full bg-[#D6FFF3]/60">
                  <TabsTrigger value="projects" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-[#0B1918]">
                    Projects
                  </TabsTrigger>
                  <TabsTrigger value="processes" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-[#0B1918]">
                    Processes
                  </TabsTrigger>
                  <TabsTrigger value="habits" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-[#0B1918]">
                    Habits
                  </TabsTrigger>
                  <TabsTrigger value="items" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-[#0B1918]">
                    All Items
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="projects" className="mt-4 space-y-4">
                  <WorkstreamList
                    workstreams={filteredWorkstreams.filter((stream) => stream.kind === "project")}
                  />
                </TabsContent>
                <TabsContent value="processes" className="mt-4 space-y-4">
                  <WorkstreamList
                    workstreams={filteredWorkstreams.filter((stream) => stream.kind === "process")}
                  />
                </TabsContent>
                <TabsContent value="habits" className="mt-4 space-y-4">
                  <WorkstreamList
                    workstreams={filteredWorkstreams.filter((stream) => stream.kind === "habit")}
                  />
                </TabsContent>
                <TabsContent value="items" className="mt-4 space-y-4">
                  <ItemList items={areaItems} />
                </TabsContent>
              </Tabs>
            )}

            {(selectedBubbleType === "project" || selectedBubbleType === "process") && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0EA8A8]">
                  Tasks & Ideas
                </h3>
                <ItemList items={areaItems} />
              </div>
            )}

            {(selectedBubbleType === "task" || selectedBubbleType === "idea") && (
              <div className="space-y-4 rounded-3xl border border-[#0EA8A8]/15 bg-white p-5 shadow-sm">
                {isLoadingItem ? (
                  <div className="py-8 text-center text-sm text-[#195552]">
                    Loading task details...
                  </div>
                ) : item ? (
                  <>
                <div>
                  <h3 className="text-sm font-semibold text-[#0B1918]">Details</h3>
                  <p className="mt-2 text-xs text-[#195552]">
                    <span className="font-medium">Type:</span> {item.type}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-[#195552]">
                      <span className="font-medium">Status:</span>{" "}
                      <span className={`font-semibold ${
                        item.status === "done" 
                          ? "text-[#0EA8A8]" 
                          : item.status === "in_progress"
                            ? "text-[#FFD833]"
                            : item.status === "pending"
                              ? "text-[#F4B13E]"
                              : "text-[#195552]/60"
                      }`}>
                        {item.status === "in_progress" ? "In Progress" : item.status}
                      </span>
                    </span>
                  </div>
                  {item.scheduled_for && (
                    <p className="mt-1 text-xs text-[#195552]">
                      <span className="font-medium">Scheduled:</span> {new Date(item.scheduled_for).toLocaleDateString()}
                    </p>
                  )}
                  {item.due_date && (
                    <p className="mt-1 text-xs text-[#195552]">
                      <span className="font-medium">Due:</span> {new Date(item.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {item.type === "task" && item.status !== "done" && item.status !== "archived" && (
                  <div className="flex gap-2">
                    {item.status !== "in_progress" && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const updated = await startTaskAction(item.id);
                            upsertItem(updated as Item);
                            upsertBubble({
                              ...selectedBubble!,
                              status: updated.status,
                            });
                            toast.success("Task started");
                          } catch (error) {
                            console.error(error);
                            toast.error("Couldn't start task");
                          }
                        }}
                        className="h-8 rounded-full bg-[#FFD833] px-4 text-xs font-semibold text-[#0B1918] hover:bg-[#FECB32]"
                      >
                        Start Task
                      </Button>
                    )}
                    {item.status === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const updated = await completeItemAction(item.id);
                            upsertItem(updated as Item);
                            upsertBubble({
                              ...selectedBubble!,
                              status: updated.status,
                            });
                            toast.success("Task completed!");
                            // Refresh XP summary
                            window.dispatchEvent(new CustomEvent("refresh-xp"));
                          } catch (error) {
                            console.error(error);
                            toast.error("Couldn't complete task");
                          }
                        }}
                        className="h-8 rounded-full bg-[#0EA8A8] px-4 text-xs font-semibold text-white hover:bg-[#0C8F90]"
                      >
                        Mark Done
                      </Button>
                    )}
                  </div>
                )}
                {item.type === "task" && item.status === "done" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const updated = await updateItemAction(item.id, { status: "pending" } as any);
                          upsertItem(updated as Item);
                          upsertBubble({
                            ...selectedBubble!,
                            status: updated.status,
                          });
                          toast.success("Task reopened");
                        } catch (error) {
                          console.error(error);
                          toast.error("Couldn't reopen task");
                        }
                      }}
                      className="h-8 rounded-full border-[#0EA8A8]/40 px-4 text-xs font-semibold text-[#0EA8A8] hover:border-[#0EA8A8]/70"
                    >
                      Reopen Task
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const updated = await updateItemAction(item.id, { status: "archived" } as any);
                          upsertItem(updated as Item);
                          useBubbleStore.getState().removeBubble(item.id);
                          toast.success("Task archived");
                          closeBubbleSheet();
                        } catch (error) {
                          console.error(error);
                          toast.error("Couldn't archive task");
                        }
                      }}
                      className="h-8 rounded-full border-[#FF7348]/40 px-4 text-xs font-semibold text-[#FF7348] hover:border-[#FF7348]/70"
                    >
                      Archive
                    </Button>
                  </div>
                )}
                {item.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#0B1918]">Notes</h4>
                    <p className="mt-1 text-xs text-[#195552]">{item.notes}</p>
                  </div>
                )}
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-[#195552]">
                    Task not found
                  </div>
                )}
              </div>
            )}

            {selectedBubbleType === "life_area" && (
              <div className="space-y-3 rounded-3xl border border-[#0EA8A8]/15 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#0B1918]">Add {activeTab.slice(0, -1)}</h3>
              <Input
                placeholder={`Name your ${activeTab.slice(0, -1)}`}
                value={workstreamTitle}
                onChange={(event) => setWorkstreamTitle(event.target.value)}
                className="rounded-full border-[#0EA8A8]/20"
              />
              <Textarea
                placeholder="Short description"
                value={workstreamDescription}
                onChange={(event) => setWorkstreamDescription(event.target.value)}
                className="min-h-[80px] rounded-2xl border-[#0EA8A8]/20"
              />
              <Button
                disabled={creatingWorkstream}
                onClick={handleCreateWorkstream}
                className="w-full rounded-full bg-[#0EA8A8] text-white transition hover:bg-[#0C8F90]"
              >
                {creatingWorkstream ? "Creating…" : "Create"}
              </Button>
              </div>
            )}

            {(selectedBubbleType === "life_area" || selectedBubbleType === "project" || selectedBubbleType === "process") && (
              <div className="space-y-3 rounded-3xl border border-[#0EA8A8]/15 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0B1918]">Capture</h3>
                <div className="rounded-full bg-[#D6FFF3]/80 p-1">
                  <button
                    onClick={() => setItemType("idea")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      itemType === "idea" ? "bg-white text-[#0B1918] shadow" : "text-[#195552]"
                    }`}
                  >
                    Idea
                  </button>
                  <button
                    onClick={() => setItemType("task")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      itemType === "task" ? "bg-white text-[#0B1918] shadow" : "text-[#195552]"
                    }`}
                  >
                    Task
                  </button>
                </div>
              </div>
              <Input
                placeholder={`Add a ${itemType}`}
                value={newItemTitle}
                onChange={(event) => setNewItemTitle(event.target.value)}
                className="rounded-full border-[#0EA8A8]/20"
              />
              <Textarea
                placeholder="Optional notes"
                value={newItemNotes}
                onChange={(event) => setNewItemNotes(event.target.value)}
                className="min-h-[80px] rounded-2xl border-[#0EA8A8]/20"
              />
              <Button
                disabled={submittingItem}
                onClick={handleCreateItem}
                className="w-full rounded-full bg-[#FFD833] text-[#0B1918] transition hover:bg-[#FECB32]"
              >
                {submittingItem ? "Saving…" : "Save"}
              </Button>
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function WorkstreamList({ workstreams }: { workstreams: Workstream[] }) {
  if (workstreams.length === 0) {
    return <EmptyState message="Nothing here yet. Create the first one." />;
  }

  return (
    <div className="space-y-3">
      {workstreams.map((stream) => (
        <motion.div
          key={stream.id}
          className="rounded-2xl border border-[#0EA8A8]/15 bg-white p-4 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0B1918]">{stream.title}</h4>
            <span className="text-xs uppercase text-[#195552]">{stream.kind}</span>
          </div>
          {stream.description && (
            <p className="mt-2 text-xs text-[#195552]">{stream.description}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function ItemList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <EmptyState message="No items yet for this area." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <motion.div
          key={item.id}
          className="rounded-2xl border border-[#0EA8A8]/15 bg-white p-4 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0B1918]">{item.title}</h4>
            <span className="text-xs uppercase text-[#195552]">{item.type}</span>
          </div>
          {item.notes && <p className="mt-2 text-xs text-slate-500">{item.notes}</p>}
        </motion.div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#0EA8A8]/20 bg-[#D6FFF3]/30 p-6 text-center text-xs text-[#195552]">
      {message}
    </div>
  );
}

function mapTabToKind(tab: TabKey): "project" | "process" | "habit" {
  switch (tab) {
    case "projects":
      return "project";
    case "processes":
      return "process";
    case "habits":
      return "habit";
    default:
      return "project";
  }
}

