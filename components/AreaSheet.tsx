"use client";

import { useMemo, useState, useEffect, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { createWorkstreamAction, updateWorkstreamAction } from "@/actions/workstreams";
import { createItemAction, updateItemAction, startTaskAction, completeItemAction, getItemAction, archiveIdeaAction, restoreIdeaAction, getArchivedIdeasAction } from "@/actions/items";
import { updateLifeAreaAction, deleteLifeAreaAction } from "@/actions/life-areas";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { Item, Workstream } from "@/types/entities";
import { useBubbleStore, RING_CONFIG, CANVAS_SIZE, type Bubble } from "@/store/bubbles";
import { getTodayISO } from "@/lib/dates";
import { toast } from "sonner";

const polarToNormalized = (radius: number, angle: number) => ({
  x: (Math.cos(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
  y: (Math.sin(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
});

type TabKey = "projects" | "processes" | "items" | "archive";

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
  const setAreas = useDashboardStore((state) => state.setAreas);
  const setWorkstreams = useDashboardStore((state) => state.setWorkstreams);
  const upsertItem = useDashboardStore((state) => state.upsertItem);
  const upsertBubble = useBubbleStore((state) => state.upsertBubble);
  const removeBubble = useBubbleStore((state) => state.removeBubble);
  const updateBubblePosition = useBubbleStore((state) => state.updateBubblePosition);
  const getNextAngle = useBubbleStore((state) => state.getNextAngle);

  const bubbles = useBubbleStore((state) => state.bubbles);
  const selectedBubble = selectedBubbleId ? bubbles[selectedBubbleId] : null;
  const [fetchedItem, setFetchedItem] = useState<Item | null>(null);
  const [isLoadingItem, setIsLoadingItem] = useState(false);

  const area = selectedBubbleType === "life_area" ? areas.find((entry) => entry.id === selectedBubbleId) : null;
  const project = (selectedBubbleType === "project" || selectedBubbleType === "process") ? workstreams.find((w) => w.id === selectedBubbleId) : null;

  const itemFromStore = (selectedBubbleType === "task" || selectedBubbleType === "idea")
    ? [...tasks, ...ideas].find((i) => i.id === selectedBubbleId)
    : null;

  const item = itemFromStore || fetchedItem;

  useEffect(() => {
    if ((selectedBubbleType === "task" || selectedBubbleType === "idea") && selectedBubbleId && !itemFromStore) {
      let cancelled = false;
      setIsLoadingItem(true);
      setFetchedItem(null);

      getItemAction(selectedBubbleId)
        .then((item) => {
          if (!cancelled && item) {
            setFetchedItem(item as Item);
            upsertItem(item as Item);
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
          if (!cancelled) setIsLoadingItem(false);
        });

      return () => { cancelled = true; setIsLoadingItem(false); };
    } else if (itemFromStore) {
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
  const [archivedIdeas, setArchivedIdeas] = useState<Item[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  useEffect(() => {
    if (activeTab === "archive" && selectedBubbleType === "life_area" && selectedBubbleId) {
      setLoadingArchived(true);
      getArchivedIdeasAction(selectedBubbleId)
        .then((items) => setArchivedIdeas(items as Item[]))
        .catch((error) => { console.error(error); toast.error("Failed to load archived ideas"); })
        .finally(() => setLoadingArchived(false));
    } else if (activeTab !== "archive") {
      setArchivedIdeas([]);
    }
  }, [activeTab, selectedBubbleType, selectedBubbleId]);

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
        lifeAreaId: targetArea.id, title: workstreamTitle, description: workstreamDescription, kind: mapTabToKind(activeTab),
      });
      setWorkstreams([...workstreams.filter((s) => s.id !== created.id), created as Workstream]);
      const bubbleType = created.kind === "process" ? "process" : "project";
      const slotAngle = getNextAngle(bubbleType, { lifeAreaId: targetArea.id });
      const config = RING_CONFIG[bubbleType];
      const normalized = polarToNormalized(config.radius, slotAngle);
      upsertBubble({ id: created.id, type: bubbleType, lifeAreaId: targetArea.id, title: created.title, status: created.active ? "active" : "archived", bubbleSize: config.baseSize, bubblePosition: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y }, metadata: { description: created.description, kind: created.kind } });
      updateBubblePosition(created.id, { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y });
      await updateWorkstreamAction(created.id, { bubble_position: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y }, bubble_size: config.baseSize } as any);
      useBubbleStore.getState().forgetLocalPosition(created.id);
      setWorkstreamTitle("");
      setWorkstreamDescription("");
    } catch (error) { console.error(error); } finally { setCreatingWorkstream(false); }
  };

  const handleCreateItem = async () => {
    if (!selectedBubbleId || !newItemTitle.trim()) return;
    let lifeAreaId: string | undefined;
    let workstreamId: string | undefined;
    if (selectedBubbleType === "life_area") { lifeAreaId = selectedBubbleId; }
    else if (selectedBubbleType === "project" || selectedBubbleType === "process") {
      workstreamId = selectedBubbleId;
      lifeAreaId = workstreams.find((w) => w.id === selectedBubbleId)?.life_area_id ?? undefined;
    } else return;
    if (!lifeAreaId) return;
    setSubmittingItem(true);
    try {
      const today = selectedDate || getTodayISO();
      const created = await createItemAction({ life_area_id: lifeAreaId, workstream_id: workstreamId, title: newItemTitle, notes: newItemNotes || null, type: itemType, status: "pending", scheduled_for: itemType === "task" ? today : null } as any);
      const bubbleType = itemType === "task" ? "task" : "idea";
      const config = RING_CONFIG[bubbleType];
      const slotAngle = getNextAngle(bubbleType, { lifeAreaId, parentId: workstreamId });
      const normalized = polarToNormalized(config.radius, slotAngle);
      const updated = await updateItemAction(created.id, { bubble_position: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y }, bubble_size: config.baseSize } as any);
      upsertItem(updated as Item);
      const newBubble: Bubble = { id: updated.id, type: bubbleType, lifeAreaId, parentId: workstreamId ?? undefined, title: updated.title, status: updated.status, bubbleSize: config.baseSize, bubblePosition: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y }, metadata: { scheduledFor: updated.scheduled_for, notes: updated.notes, __locked: true } };
      upsertBubble(newBubble);
      updateBubblePosition(updated.id, { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y });
      const bubbleStore = useBubbleStore.getState();
      const currentBubble = bubbleStore.bubbles[updated.id];
      if (currentBubble && !currentBubble.metadata?.__locked) {
        bubbleStore.upsertBubble({ ...currentBubble, metadata: { ...currentBubble.metadata, __locked: true } });
      }
      toast.success(`${itemType === "task" ? "Task" : "Idea"} added`);
      setNewItemTitle("");
      setNewItemNotes("");
    } catch (error) { console.error(error); toast.error(`Failed to create ${itemType}`); } finally { setSubmittingItem(false); }
  };

  const isOpen = Boolean(selectedBubbleId && selectedBubble);
  const displayTitle = area?.name || project?.title || item?.title || "";
  const displayColor = area?.color || (selectedBubble?.type === "project" ? "#7FE5D1" : selectedBubble?.type === "process" ? "#FFBC85" : selectedBubble?.type === "task" ? "#FF7348" : selectedBubble?.type === "idea" ? "#DED6FF" : "#0EA8A8");

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && closeBubbleSheet()}>
      <SheetContent side="right" className="flex w-full sm:!max-w-xl flex-col gap-0 overflow-y-auto bg-background p-4 sm:p-6">
        {selectedBubble ? (
          <>
            <SheetHeader className="p-0 pb-4">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="flex items-center gap-2 text-base sm:text-lg font-bold min-w-0">
                  <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: displayColor }} />
                  {selectedBubbleType === "life_area" && area ? (
                    <input
                      type="text"
                      defaultValue={area.name}
                      onBlur={(e) => {
                        const newName = e.target.value.trim();
                        if (newName && newName !== area.name) {
                          updateLifeAreaAction(area.id, { name: newName })
                            .then((updated) => {
                              setAreas(areas.map((a) => (a.id === updated.id ? updated as any : a)));
                              upsertBubble({ ...selectedBubble!, title: updated.name });
                              toast.success("Renamed");
                            })
                            .catch((err) => { console.error(err); toast.error("Failed to rename"); e.target.value = area.name; });
                        } else if (!newName) { e.target.value = area.name; }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      className="text-base sm:text-lg font-bold border-none p-0 h-auto focus-visible:ring-0 bg-transparent outline-none min-w-0 w-full truncate"
                    />
                  ) : (
                    <span className="truncate">{displayTitle}</span>
                  )}
                </SheetTitle>
                {selectedBubbleType === "life_area" && area && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 rounded-lg px-3 text-xs"
                    onClick={async () => {
                      if (confirm(`Delete "${area.name}"? All projects and items will be removed.`)) {
                        try {
                          await deleteLifeAreaAction(area.id);
                          setAreas(areas.filter((a) => a.id !== area.id));
                          removeBubble(area.id);
                          toast.success("Deleted");
                          closeBubbleSheet();
                        } catch (err) { console.error(err); toast.error("Failed to delete"); }
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
              {selectedBubble.metadata?.description ? (
                <SheetDescription>{String(selectedBubble.metadata.description)}</SheetDescription>
              ) : null}
            </SheetHeader>

            <Separator className="my-3" />

            {/* Life Area: Tabs for Projects / Processes / Archive / Items */}
            {selectedBubbleType === "life_area" && (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
                <TabsList className="w-full h-8">
                  <TabsTrigger value="projects" className="flex-1 text-xs">Projects</TabsTrigger>
                  <TabsTrigger value="processes" className="flex-1 text-xs">Processes</TabsTrigger>
                  <TabsTrigger value="archive" className="flex-1 text-xs">Archive</TabsTrigger>
                  <TabsTrigger value="items" className="flex-1 text-xs">All</TabsTrigger>
                </TabsList>
                <TabsContent value="projects" className="mt-3 space-y-2">
                  <WorkstreamList workstreams={filteredWorkstreams.filter((s) => s.kind === "project")} />
                </TabsContent>
                <TabsContent value="processes" className="mt-3 space-y-2">
                  <WorkstreamList workstreams={filteredWorkstreams.filter((s) => s.kind === "process")} />
                </TabsContent>
                <TabsContent value="archive" className="mt-3 space-y-2">
                  {loadingArchived ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
                  ) : archivedIdeas.length === 0 ? (
                    <EmptyState message="No archived ideas yet." />
                  ) : (
                    <div className="space-y-2">
                      {archivedIdeas.map((idea) => (
                        <Card key={idea.id} className="py-3">
                          <CardContent className="flex items-center justify-between gap-3 px-4 py-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{idea.title}</p>
                              {idea.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{idea.notes}</p>}
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                              onClick={async () => {
                                try { const r = await restoreIdeaAction(idea.id); upsertItem(r as Item); setArchivedIdeas((p) => p.filter((i) => i.id !== idea.id)); toast.success("Restored"); }
                                catch { toast.error("Couldn't restore"); }
                              }}>Restore</Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="items" className="mt-3 space-y-2">
                  <ItemList items={areaItems} />
                </TabsContent>
              </Tabs>
            )}

            {/* Project/Process: Show child items */}
            {(selectedBubbleType === "project" || selectedBubbleType === "process") && (
              <div className="space-y-3 mt-3">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Tasks & Ideas</p>
                <ItemList items={areaItems} />
              </div>
            )}

            {/* Task/Idea detail view */}
            {(selectedBubbleType === "task" || selectedBubbleType === "idea") && (
              <Card className="py-4 mt-3">
                <CardContent className="space-y-4 px-4 py-0">
                  {isLoadingItem ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
                  ) : item ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="capitalize">{item.type}</Badge>
                        <Badge variant={item.status === "done" ? "default" : item.status === "in_progress" ? "secondary" : "outline"} className="capitalize">
                          {item.status === "in_progress" ? "In Progress" : item.status}
                        </Badge>
                      </div>
                      {item.scheduled_for && (
                        <p className="text-xs text-muted-foreground">Scheduled: {new Date(item.scheduled_for).toLocaleDateString()}</p>
                      )}
                      {item.due_date && (
                        <p className="text-xs text-muted-foreground">Due: {new Date(item.due_date).toLocaleDateString()}</p>
                      )}
                      {item.notes && (
                        <div>
                          <p className="text-xs font-medium mb-1">Notes</p>
                          <p className="text-xs text-muted-foreground">{item.notes}</p>
                        </div>
                      )}
                      <Separator />
                      <div className="flex flex-wrap gap-2">
                        {item.type === "task" && item.status !== "done" && item.status !== "archived" && (
                          <>
                            {item.status !== "in_progress" && (
                              <Button size="sm" className="h-8 text-xs"
                                onClick={async () => { try { const u = await startTaskAction(item.id); upsertItem(u as Item); upsertBubble({ ...selectedBubble!, status: u.status }); toast.success("Started"); } catch { toast.error("Failed"); } }}>
                                Start Task
                              </Button>
                            )}
                            {item.status === "in_progress" && (
                              <Button size="sm" className="h-8 text-xs"
                                onClick={async () => { try { const u = await completeItemAction(item.id); upsertItem(u as Item); upsertBubble({ ...selectedBubble!, status: u.status }); toast.success("Done!"); window.dispatchEvent(new CustomEvent("refresh-xp")); } catch { toast.error("Failed"); } }}>
                                Mark Done
                              </Button>
                            )}
                          </>
                        )}
                        {item.type === "task" && item.status === "done" && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 text-xs"
                              onClick={async () => { try { const u = await updateItemAction(item.id, { status: "pending" } as any); upsertItem(u as Item); upsertBubble({ ...selectedBubble!, status: u.status }); toast.success("Reopened"); } catch { toast.error("Failed"); } }}>
                              Reopen
                            </Button>
                            <Button size="sm" variant="destructive" className="h-8 text-xs"
                              onClick={async () => { try { await updateItemAction(item.id, { status: "archived" } as any); useBubbleStore.getState().removeBubble(item.id); toast.success("Archived"); closeBubbleSheet(); } catch { toast.error("Failed"); } }}>
                              Archive
                            </Button>
                          </>
                        )}
                        {item.type === "idea" && item.status !== "archived" && (
                          <Button size="sm" variant="destructive" className="h-8 text-xs"
                            onClick={async () => { try { const a = await archiveIdeaAction(item.id); upsertItem(a as Item); useBubbleStore.getState().removeBubble(item.id); toast.success("Archived"); closeBubbleSheet(); } catch { toast.error("Failed"); } }}>
                            Archive Idea
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">Not found</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Create workstream form */}
            {selectedBubbleType === "life_area" && (
              <Card className="py-4 mt-3">
                <CardContent className="space-y-3 px-4 py-0">
                  <p className="text-sm font-medium">Add {activeTab.slice(0, -1)}</p>
                  <Input placeholder={`Name your ${activeTab.slice(0, -1)}`} value={workstreamTitle} onChange={(e) => setWorkstreamTitle(e.target.value)} />
                  <Textarea placeholder="Short description" value={workstreamDescription} onChange={(e) => setWorkstreamDescription(e.target.value)} className="min-h-[72px] resize-none" />
                  <Button disabled={creatingWorkstream} onClick={handleCreateWorkstream} className="w-full">{creatingWorkstream ? "Creating…" : "Create"}</Button>
                </CardContent>
              </Card>
            )}

            {/* Capture item form */}
            {(selectedBubbleType === "life_area" || selectedBubbleType === "project" || selectedBubbleType === "process") && (
              <Card className="py-4 mt-3">
                <CardContent className="space-y-3 px-4 py-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Capture</p>
                    <div className="inline-flex rounded-lg bg-muted p-0.5">
                      <button onClick={() => setItemType("idea")} className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition ${itemType === "idea" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Idea</button>
                      <button onClick={() => setItemType("task")} className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition ${itemType === "task" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Task</button>
                    </div>
                  </div>
                  <Input placeholder={`Add a ${itemType}`} value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} />
                  <Textarea placeholder="Optional notes" value={newItemNotes} onChange={(e) => setNewItemNotes(e.target.value)} className="min-h-[72px] resize-none" />
                  <Button disabled={submittingItem} onClick={handleCreateItem} variant="secondary" className="w-full">{submittingItem ? "Saving…" : "Save"}</Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function WorkstreamList({ workstreams }: { workstreams: Workstream[] }) {
  if (workstreams.length === 0) return <EmptyState message="Nothing here yet." />;
  return (
    <div className="space-y-2">
      {workstreams.map((stream) => (
        <Card key={stream.id} className="py-3">
          <CardContent className="px-4 py-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{stream.title}</p>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">{stream.kind}</Badge>
            </div>
            {stream.description && <p className="mt-1 text-xs text-muted-foreground">{stream.description}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ItemList({ items }: { items: Item[] }) {
  if (items.length === 0) return <EmptyState message="No items yet." />;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id} className="py-3">
          <CardContent className="px-4 py-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <Badge variant={item.type === "task" ? "default" : "secondary"} className="text-[10px] capitalize shrink-0">{item.type}</Badge>
            </div>
            {item.notes && <p className="mt-1 text-xs text-muted-foreground truncate">{item.notes}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function mapTabToKind(tab: TabKey): "project" | "process" | "habit" {
  switch (tab) {
    case "projects": return "project";
    case "processes": return "process";
    default: return "project";
  }
}
