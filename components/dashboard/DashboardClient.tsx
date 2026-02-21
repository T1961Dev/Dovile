"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { Pencil, LogOut, Menu, X } from "lucide-react";

import { AvatarCoach } from "@/components/AvatarCoach";
import { AreaSheet } from "@/components/AreaSheet";
import { CapacityHUD } from "@/components/CapacityHUD";
import { GamificationHUD } from "@/components/GamificationHUD";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { PaywallDialog } from "@/components/PaywallDialog";
import { DayByDayTimeline } from "@/components/DayByDayTimeline";
import { WheelOfLifeOverlay } from "@/components/WheelOfLifeOverlay";
import { EmptyHeadPanel } from "@/components/dashboard/EmptyHeadPanel";
import { PlannerOverlay } from "@/components/dashboard/PlannerOverlay";
import { ScopeZoomControl } from "@/components/ScopeZoomControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/store/useDashboardStore";
import { CircleCanvas } from "@/components/CircleCanvas";
import { RING_CONFIG, CANVAS_SIZE, useBubbleStore } from "@/store/bubbles";
import type { BubbleType, Bubble } from "@/store/bubbles";
import type { BubbleDropResult } from "@/components/CircleCanvas";
import { DEFAULT_DAILY_CAPACITY, MAX_FREE_ITEMS } from "@/lib/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DashboardData } from "@/lib/queries";
import { useRouter } from "next/navigation";
import type { CalendarEvent, Item, LifeArea, Workstream, XpSummary } from "@/types/entities";
import type { Database } from "@/types/database";
import { updateItemAction, createItemAction } from "@/actions/items";
import { updateWorkstreamAction } from "@/actions/workstreams";
import { updateLifeAreaAction } from "@/actions/life-areas";
import { fetchSuggestionsAction } from "@/actions/ai/suggestions";
import { useInsightStore } from "@/store/insights";

// Canvas Pan Wrapper - makes the entire screen draggable (except header)
function CanvasPanWrapper({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ isPanning: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({ 
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0
  });

  const resetView = () => {
    setPanPosition({ x: 0, y: 0 });
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.5s ease-out';
      containerRef.current.style.transform = 'translate(0px, 0px)';
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = '';
        }
      }, 500);
    }
  };

  // Listen for center-view events
  useEffect(() => {
    const handleCenterView = () => {
      resetView();
    };
    window.addEventListener('center-view', handleCenterView);
    return () => {
      window.removeEventListener('center-view', handleCenterView);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking on non-interactive elements
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('[data-bubble-id]') || 
                         target.closest('button') || 
                         target.closest('input') ||
                         target.closest('textarea') ||
                         target.closest('select') ||
                         target.closest('a') ||
                         target.closest('[role="button"]') ||
                         target.closest('[role="tab"]') ||
                         target.closest('svg') ||
                         target.closest('canvas') ||
                         target.closest('[draggable="true"]');
    
    // Allow panning on empty space or background elements
    if (!isInteractive) {
      panRef.current.isPanning = true;
      panRef.current.startX = e.clientX;
      panRef.current.startY = e.clientY;
      panRef.current.startPanX = panPosition.x;
      panRef.current.startPanY = panPosition.y;
      
      // Add global listeners for infinite dragging
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
      
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!panRef.current.isPanning || !containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const deltaX = e.clientX - panRef.current.startX;
    const deltaY = e.clientY - panRef.current.startY;
    
    const newX = panRef.current.startPanX + deltaX;
    const newY = panRef.current.startPanY + deltaY;
    
    setPanPosition({ x: newX, y: newY });
    containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    containerRef.current.style.transition = 'none'; // Disable transitions during drag
  }, []);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    handleMouseMove(e);
  }, [handleMouseMove]);

  const handleMouseUp = useCallback(() => {
    if (panRef.current.isPanning && containerRef.current) {
      // Re-enable transitions after drag
      containerRef.current.style.transition = '';
    }
    panRef.current.isPanning = false;
    // Remove global listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleGlobalMouseMove]);

  // Apply pan position on mount and when it changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translate(${panPosition.x}px, ${panPosition.y}px)`;
    }
  }, [panPosition.x, panPosition.y]);

  // Cleanup global listeners on unmount
  useEffect(() => {
    const handleCenterView = () => {
      resetView();
    };
    window.addEventListener('center-view', handleCenterView);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('center-view', handleCenterView);
    };
  }, [handleGlobalMouseMove, handleMouseUp]);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          cursor: panRef.current.isPanning ? 'grabbing' : 'grab',
          touchAction: 'none',
          willChange: panRef.current.isPanning ? 'transform' : 'auto'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => handleMouseMove(e as any)}
        onMouseUp={handleMouseUp}
      >
        {children}
      </div>
      {/* Reset View Button - Fixed in lower right corner */}
      <button
        onClick={resetView}
        className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-50 flex h-10 w-10 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full bg-card shadow-md border border-primary/30 hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation"
        title="Center view"
        aria-label="Center view"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </button>
    </>
  );
}

type ItemRow = Database["public"]["Tables"]["items"]["Row"];

const polarToNormalized = (radius: number, angle: number) => ({
  x: (Math.cos(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
  y: (Math.sin(angle) * radius + CANVAS_SIZE / 2) / CANVAS_SIZE,
});

type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];

type DashboardClientProps = {
  user: User;
  date: string;
  timezone: string;
  data: DashboardData;
  settings: SettingsRow | null;
  xpSummary: XpSummary;
  events: CalendarEvent[];
  onDateChange?: (date: string) => Promise<DashboardData>;
};

export function DashboardClient({
  user,
  date,
  timezone,
  data,
  settings,
  xpSummary: initialXpSummary,
  events,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [xpSummary, setXpSummary] = useState(initialXpSummary);
  const [hydrated, setHydrated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshXpSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/xp/summary", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setXpSummary(data);
      }
    } catch (error) {
      console.error("Failed to refresh XP summary:", error);
    }
  }, []);
  const hydrate = useDashboardStore((state) => state.hydrate);
  const setWheelOverlayOpen = useDashboardStore((state) => state.setWheelOverlayOpen);
  const setCoachOpen = useDashboardStore((state) => state.setCoachOpen);
  const setPaywallOpen = useDashboardStore((state) => state.setPaywallOpen);
  const setEmptyHeadOpen = useDashboardStore((state) => state.setEmptyHeadOpen);
  const setPlannerOpen = useDashboardStore((state) => state.setPlannerOpen);
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const tasks = useDashboardStore((state) => state.tasks);
  const areaCount = useDashboardStore((state) => state.areas.length);
  const upsertItem = useDashboardStore((state) => state.upsertItem);
  const removeItem = useDashboardStore((state) => state.removeItem);
  const openAreaSheet = useDashboardStore((state) => state.openAreaSheet);
  const setWorkstreams = useDashboardStore((state) => state.setWorkstreams);
  const hydrateBubbles = useBubbleStore((state) => state.hydrateFromServer);
  const syncUserContext = useBubbleStore((state) => state.syncUserContext);
  const updateBubblePosition = useBubbleStore((state) => state.updateBubblePosition);
  const pinnedBubbleId = useBubbleStore((state) => state.pinnedBubbleId);
  const setPinnedBubble = useBubbleStore((state) => state.setPinnedBubble);
  const selectedBubbleId = useDashboardStore((state) => state.selectedBubbleId);
  const selectedBubbleType = useDashboardStore((state) => state.selectedBubbleType);
  const { suggestions, setSuggestionsForBubble, removeSuggestion } = useInsightStore();
  const filteredSuggestions = suggestions.filter(
    (suggestion) => suggestion.bubbleId === selectedBubbleId,
  );


  useLayoutEffect(() => {
    syncUserContext(user.id);
  }, [syncUserContext, user.id]);

  const mountedRef = useRef(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    hydrate({
      date,
      areas: data.areas,
      workstreams: data.workstreams,
      tasks: data.todayTasks,
      ideas: data.ideas,
      events,
    });
    const wheelItems = (data.allTasks ?? []).concat(data.ideas ?? []);
    hydrateBubbles({
      lifeAreas: data.areas,
      workstreams: data.workstreams,
      items: wheelItems,
    });
    setHydrated(true);
  }, [hydrate, date, data, events, hydrateBubbles]);

  // Fetch fresh data whenever the user picks a different date on the timeline
  useEffect(() => {
    if (!hydrated || !selectedDate) return;

    // Skip the very first run — data was already loaded from server props above
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    // Increment a fetch counter so stale responses from rapid scrubbing are dropped
    const id = ++fetchIdRef.current;

    const loadTimelineData = async () => {
      try {
        const { getTimelineData } = await import("@/actions/timeline");
        const payload = await getTimelineData(selectedDate, "day", "full", timezone);

        // If the user already moved to another date while we were fetching, discard
        if (id !== fetchIdRef.current) return;

        hydrate({
          date: selectedDate,
          areas: payload.areas ?? [],
          workstreams: payload.workstreams ?? [],
          tasks: payload.todayTasks ?? [],
          ideas: payload.ideas ?? [],
          events: payload.events ?? [],
        });
        const wheelItems = [...(payload.allTasks ?? []), ...(payload.ideas ?? [])];
        hydrateBubbles({
          lifeAreas: payload.areas ?? [],
          workstreams: payload.workstreams ?? [],
          items: wheelItems,
        });
      } catch (error) {
        if (id !== fetchIdRef.current) return;
        console.error("[DashboardClient] Error loading timeline:", error);
        toast.error(`Failed to load timeline: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };

    loadTimelineData();
  }, [selectedDate, timezone, hydrated, hydrate, hydrateBubbles]);

  const mapRowToItem = (row: ItemRow): Item =>
    ({
      ...row,
      bubble_size: row.bubble_size ?? null,
      bubble_position: (row.bubble_position as { ring: number; angle: number } | null) ?? null,
    }) as Item;

  const bubbleFromItemRow = (row: ItemRow, fallbackAngle: number): Bubble => {
    const type: BubbleType = row.type === "task" ? "task" : "idea";
    const storedPosition = (row.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
    const ring =
      typeof storedPosition?.ring === "number" ? storedPosition.ring : RING_CONFIG[type].radius;
    const angle =
      typeof storedPosition?.angle === "number" ? storedPosition.angle : fallbackAngle;
    const size =
      typeof row.bubble_size === "number" && !Number.isNaN(row.bubble_size)
        ? Number(row.bubble_size)
        : RING_CONFIG[type].baseSize;
    
    // Include x, y coordinates if present, otherwise calculate from ring/angle
    const normalized = storedPosition?.x != null && storedPosition?.y != null
      ? { x: storedPosition.x, y: storedPosition.y }
      : { x: (Math.cos(angle) * ring + CANVAS_SIZE / 2) / CANVAS_SIZE, y: (Math.sin(angle) * ring + CANVAS_SIZE / 2) / CANVAS_SIZE };

    return {
      id: row.id,
      type,
      lifeAreaId: row.life_area_id ?? undefined,
      parentId: row.workstream_id ?? undefined,
      title: row.title,
      status: row.status,
      bubbleSize: size,
      bubblePosition: { ring, angle, x: normalized.x, y: normalized.y },
      metadata: {
        scheduledFor: row.scheduled_for,
        notes: row.notes,
        completedAt: row.completed_at,
        __locked: Boolean(storedPosition && (storedPosition.x != null || storedPosition.y != null)),
      },
    };
  };

  const angularDiff = (a: number, b: number) =>
    Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  const findNearestBubbleByType = (
    type: BubbleType | "project_or_process",
    angle: number,
    lifeAreaId?: string,
  ): Bubble | null => {
    const bubblesState = useBubbleStore.getState().bubbles;
    let best: Bubble | null = null;
    let bestDiff = Infinity;
    Object.values(bubblesState).forEach((candidate) => {
      const candidateType =
        type === "project_or_process"
          ? candidate.type === "project" || candidate.type === "process"
          : candidate.type === type;
      if (!candidateType) return;
      if (lifeAreaId && candidate.lifeAreaId !== lifeAreaId) return;
      const candidateAngle = candidate.bubblePosition?.angle ?? 0;
      const diff = angularDiff(angle, candidateAngle);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidate;
      }
    });
    return best;
  };

  const handleBubbleDrop = async (bubble: Bubble, drop: BubbleDropResult) => {
    const angle = drop.angle;
    const half = CANVAS_SIZE / 2;
    const baseCoords = {
      x: half + Math.cos(angle) * RING_CONFIG[bubble.type].radius,
      y: half + Math.sin(angle) * RING_CONFIG[bubble.type].radius,
    };

    const coordsForType = (type: BubbleType, customAngle = angle) => ({
      x: half + Math.cos(customAngle) * RING_CONFIG[type].radius,
      y: half + Math.sin(customAngle) * RING_CONFIG[type].radius,
    });

    const upsertBubble = useBubbleStore.getState().upsertBubble;
    const removeItem = useDashboardStore.getState().removeItem;
    const upsertItemToStore = useDashboardStore.getState().upsertItem;

    try {
      if (bubble.type === "idea" && drop.target === "task") {
        const nearestLifeArea = findNearestBubbleByType("life_area", angle);
        const newLifeArea =
          nearestLifeArea?.lifeAreaId ?? nearestLifeArea?.id ?? bubble.lifeAreaId;
        const payload: Record<string, unknown> = { type: "task" };
        if (newLifeArea) {
          payload.life_area_id = newLifeArea;
        }
        payload.bubble_position = { ring: RING_CONFIG.task.radius, angle };
        payload.bubble_size = RING_CONFIG.task.baseSize;
        const updated = await updateItemAction(bubble.id, payload as any);

        removeItem(bubble.id);
        upsertItemToStore(mapRowToItem(updated));

        const nextBubble = bubbleFromItemRow(updated, angle);
        upsertBubble(nextBubble);
        toast.success("Idea converted into a task.");
        return;
      }

      if (drop.target === "project") {
        const nearestProject = findNearestBubbleByType(
          "project_or_process",
          angle,
          bubble.lifeAreaId,
        );
        if (!nearestProject) {
          updateBubblePosition(bubble.id, {
            ring: RING_CONFIG[bubble.type].radius,
            angle,
          });
          toast.info("No project nearby to attach.");
          return;
        }

        if (bubble.type === "idea" || bubble.type === "task") {
          const payload: Record<string, unknown> = {
            workstream_id: nearestProject.id,
          };
          const newLifeArea = nearestProject.lifeAreaId ?? bubble.lifeAreaId;
          if (newLifeArea) {
            payload.life_area_id = newLifeArea;
          }
          payload.bubble_position = { ring: RING_CONFIG[bubble.type].radius, angle };
          const updated = await updateItemAction(bubble.id, payload as any);
          upsertItemToStore(mapRowToItem(updated));
          const nextBubble = bubbleFromItemRow(updated, angle);
          upsertBubble(nextBubble);
          toast.success("Linked to project.");
          return;
        }
      }

      if (drop.target === "life_area" && (bubble.type === "idea" || bubble.type === "task")) {
        const nearestArea = findNearestBubbleByType("life_area", angle);
        if (!nearestArea) {
          updateBubblePosition(bubble.id, {
            ring: RING_CONFIG[bubble.type].radius,
            angle,
          });
          return;
        }

        const payload: Record<string, unknown> = {
          workstream_id: bubble.parentId ?? null,
        };
        const newLifeArea = nearestArea.lifeAreaId ?? nearestArea.id;
        if (newLifeArea) {
          payload.life_area_id = newLifeArea;
        }
        payload.bubble_position = { ring: RING_CONFIG[bubble.type].radius, angle };
        const updated = await updateItemAction(bubble.id, payload as any);

        upsertItemToStore(mapRowToItem(updated));
        const nextBubble = bubbleFromItemRow(updated, angle);
        upsertBubble(nextBubble);
        toast.success("Life area updated.");
        return;
      }

      // Reposition within same ring
      const persistPosition = {
        ring: RING_CONFIG[bubble.type].radius,
        angle,
      };
      
      // If moving a life area, move all children proportionally
      if (bubble.type === "life_area") {
        const bubbleStore = useBubbleStore.getState();
        const allBubbles = Object.values(bubbleStore.bubbles);
        const oldAngle = bubble.bubblePosition?.angle ?? 0;
        const angleDelta = angle - oldAngle;
        
        // Find all children (projects, processes, tasks, ideas) of this life area
        const children = allBubbles.filter(
          (child) => child.lifeAreaId === bubble.id || child.parentId === bubble.id
        );
        
        // Move each child by the same angle delta
        children.forEach((child) => {
          const childOldAngle = child.bubblePosition?.angle ?? 0;
          const newChildAngle = childOldAngle + angleDelta;
          const childPosition = {
            ring: RING_CONFIG[child.type].radius,
            angle: newChildAngle,
          };
          updateBubblePosition(child.id, childPosition);
          
          // Persist child positions
          if (child.type === "task" || child.type === "idea") {
            updateItemAction(child.id, { bubble_position: childPosition } as any).catch(console.error);
          } else if (child.type === "project" || child.type === "process") {
            updateWorkstreamAction(child.id, { bubble_position: childPosition } as any).catch(console.error);
          }
        });
      }
      
      updateBubblePosition(bubble.id, persistPosition);
      if (bubble.type === "task" || bubble.type === "idea") {
        await updateItemAction(bubble.id, { bubble_position: persistPosition } as any);
        useBubbleStore.getState().forgetLocalPosition(bubble.id);
      } else if (bubble.type === "project" || bubble.type === "process") {
        await updateWorkstreamAction(bubble.id, { bubble_position: persistPosition } as any);
        useBubbleStore.getState().forgetLocalPosition(bubble.id);
      } else if (bubble.type === "life_area") {
        await updateLifeAreaAction(bubble.id, { bubble_position: persistPosition } as any);
        useBubbleStore.getState().forgetLocalPosition(bubble.id);
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong updating this bubble.");
    }
  };

  useEffect(() => {
    if (!selectedBubbleId) return;
    const bubble = useBubbleStore.getState().bubbles[selectedBubbleId];
    if (!bubble) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      fetchSuggestionsAction({
        bubbleId: bubble.id,
        bubbleType: bubble.type,
        bubbleTitle: bubble.title,
      })
        .then((result) => {
          if (!cancelled) {
            setSuggestionsForBubble(bubble.id, result);
          }
        })
        .catch((error) => console.error(error));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [selectedBubbleId, setSuggestionsForBubble]);

  const handleApplySuggestion = async (suggestionId: string) => {
    if (!selectedBubbleId) return;
    const bubble = useBubbleStore.getState().bubbles[selectedBubbleId];
    if (!bubble) return;
    const suggestion = suggestions.find((entry) => entry.id === suggestionId);
    if (!suggestion) return;

    try {
      let lifeAreaId: string | undefined;
      let workstreamId: string | undefined;
      const angle = bubble.bubblePosition?.angle ?? 0;

      switch (bubble.type) {
        case "life_area":
          lifeAreaId = bubble.lifeAreaId ?? bubble.id;
          break;
        case "project":
        case "process":
          lifeAreaId = bubble.lifeAreaId;
          workstreamId = bubble.id;
          break;
        case "task":
        case "idea":
          lifeAreaId = bubble.lifeAreaId;
          workstreamId = bubble.parentId;
          break;
        default:
          lifeAreaId = bubble.lifeAreaId;
      }

      if (!lifeAreaId) {
        toast.error("Add a life area first to capture this suggestion.");
        return;
      }

      const created = await createItemAction({
        title: suggestion.title,
        notes: suggestion.description,
        type: suggestion.type,
        life_area_id: lifeAreaId,
        workstream_id: workstreamId ?? null,
        status: "pending",
      } as any);

      const bubbleStore = useBubbleStore.getState();
      const bubbleType: BubbleType = suggestion.type === "idea" ? "idea" : "task";
      const slotAngle = bubbleStore.getNextAngle(bubbleType, {
        lifeAreaId,
        parentId: workstreamId ?? undefined,
        anchorAngle: angle,
      });
      const config = RING_CONFIG[bubbleType];
      const normalized = polarToNormalized(config.radius, slotAngle);
      const updated = await updateItemAction(created.id, {
        bubble_position: { ring: config.radius, angle: slotAngle, x: normalized.x, y: normalized.y },
        bubble_size: config.baseSize,
      } as any);

      upsertItem(mapRowToItem(updated));
      const newBubble = bubbleFromItemRow(updated, slotAngle);
      setPinnedBubble(newBubble.id);
      useBubbleStore.getState().upsertBubble(newBubble);
      useBubbleStore.getState().forgetLocalPosition(newBubble.id);
      removeSuggestion(suggestionId);
      toast.success("Suggestion added to your scope.");
    } catch (error) {
      console.error(error);
      toast.error("Couldn't apply this suggestion.");
    }
  };

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const channel = supabase
      .channel(`dashboard-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldItem = payload.old as Item | null;
            if (oldItem?.id) {
              removeItem(oldItem.id);
              useBubbleStore.getState().removeBubble(oldItem.id);
            }
          } else if (payload.new) {
            const newItem = payload.new as Item;
            upsertItem(newItem);
            
            // Also sync to bubble store - but don't overwrite if we already have it with __locked
            const bubbleStore = useBubbleStore.getState();
            const existingBubble = bubbleStore.bubbles[newItem.id];
            
            // If we already have this bubble with __locked metadata, don't overwrite it
            if (existingBubble?.metadata?.__locked) {
              return;
            }
            
            const rowItem = mapRowToItem(newItem);
            // Use the existing bubble's angle if available, otherwise default to 0
            const fallbackAngle = existingBubble?.bubblePosition?.angle ?? 0;
            const bubble = bubbleFromItemRow(rowItem, fallbackAngle);
            // Preserve __locked flag if it exists, or set it for newly created items
            if (existingBubble?.metadata?.__locked || !existingBubble) {
              bubble.metadata = { ...bubble.metadata, __locked: true };
            }
            bubbleStore.upsertBubble(bubble);
            
            // Refresh XP if task was completed
            if (newItem.type === "task" && newItem.status === "done") {
              refreshXpSummary();
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workstreams",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldStream = payload.old as Workstream | null;
            if (oldStream?.id) {
              const current = useDashboardStore.getState().workstreams;
              setWorkstreams(current.filter((stream) => stream.id !== oldStream.id));
              useBubbleStore.getState().removeBubble(oldStream.id);
            }
          } else if (payload.new) {
            const newStream = payload.new as Workstream;
            const current = useDashboardStore.getState().workstreams;
            const filtered = current.filter((stream) => stream.id !== newStream.id);
            setWorkstreams([...filtered, newStream]);
            
            // Also sync to bubble store
            const bubbleStore = useBubbleStore.getState();
            // Convert workstream to bubble using the store's internal logic
            const storedPosition = (newStream.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
            const bubbleType = newStream.kind === "process" ? "process" : "project";
            const config = RING_CONFIG[bubbleType];
            const ring = typeof storedPosition?.ring === "number" ? storedPosition.ring : config.radius;
            const angle = typeof storedPosition?.angle === "number" ? storedPosition.angle : 0;
            const normalized = storedPosition?.x != null && storedPosition?.y != null
              ? { x: storedPosition.x, y: storedPosition.y }
              : { x: (Math.cos(angle) * ring + CANVAS_SIZE / 2) / CANVAS_SIZE, y: (Math.sin(angle) * ring + CANVAS_SIZE / 2) / CANVAS_SIZE };
            
            const bubble: Bubble = {
              id: newStream.id,
              type: bubbleType,
              lifeAreaId: newStream.life_area_id ?? undefined,
              title: newStream.title,
              status: newStream.active ? "active" : "archived",
              bubbleSize: typeof newStream.bubble_size === "number" ? newStream.bubble_size : config.baseSize,
              bubblePosition: { ring, angle, x: normalized.x, y: normalized.y },
              metadata: {
                description: newStream.description,
                kind: newStream.kind,
                __locked: Boolean(storedPosition),
              },
            };
            bubbleStore.upsertBubble(bubble);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "xp_events",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh XP summary when XP events change
          refreshXpSummary();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "life_areas",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const setAreas = useDashboardStore.getState().setAreas;
          const bubbleStore = useBubbleStore.getState();
          
          if (payload.eventType === "DELETE") {
            const oldArea = payload.old as LifeArea | null;
            if (oldArea?.id) {
              const current = useDashboardStore.getState().areas;
              setAreas(current.filter((area) => area.id !== oldArea.id));
              bubbleStore.removeBubble(oldArea.id);
            }
          } else if (payload.new) {
            const newArea = payload.new as LifeArea;
            const current = useDashboardStore.getState().areas;
            const filtered = current.filter((area) => area.id !== newArea.id);
            setAreas([...filtered, newArea]);
            
            // Also sync to bubble store
            const storedPosition = (newArea.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
            const ring = typeof storedPosition?.ring === "number" ? storedPosition.ring : RING_CONFIG.life_area.radius;
            const angle = typeof storedPosition?.angle === "number" ? storedPosition.angle : 0;
            const normalized = storedPosition?.x != null && storedPosition?.y != null
              ? { x: storedPosition.x, y: storedPosition.y }
              : { x: (Math.cos(angle) * ring + CANVAS_SIZE / 2) / CANVAS_SIZE, y: (Math.sin(angle) * ring + CANVAS_SIZE / 2) / CANVAS_SIZE };
            
            const bubble: Bubble = {
              id: newArea.id,
              type: "life_area",
              lifeAreaId: newArea.id,
              title: newArea.name,
              status: "active",
              bubbleSize: typeof newArea.bubble_size === "number" ? newArea.bubble_size : RING_CONFIG.life_area.baseSize,
              bubblePosition: { ring, angle, x: normalized.x, y: normalized.y },
              metadata: {
                color: newArea.color,
                rating: newArea.rating,
                visionText: newArea.vision_text,
                __locked: Boolean(storedPosition),
              },
            };
            bubbleStore.upsertBubble(bubble);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [removeItem, setWorkstreams, upsertItem, user.id, refreshXpSummary]);

  useEffect(() => {
    if (data.totalItemCount > MAX_FREE_ITEMS) {
      setPaywallOpen(true);
      toast.warning("You reached the free tier limit. Upgrade to add more items.");
    }
  }, [data.totalItemCount, setPaywallOpen]);

  const dailyCapacity = settings?.daily_capacity ?? DEFAULT_DAILY_CAPACITY;

  const onboardingComplete = areaCount >= 8;

  const handleSelectBubble = (bubbleId: string) => {
    const bubbles = useBubbleStore.getState().bubbles;
    const bubble = bubbles[bubbleId];
    if (!bubble) return;

    const openBubbleSheet = useDashboardStore.getState().openBubbleSheet;
    // Only open sheet for supported bubble types
    if (bubble.type !== "vision") {
      openBubbleSheet(bubbleId, bubble.type);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error("Failed to log out");
      console.error(error);
    }
  };

  return (
    <div className="relative flex h-screen flex-col bg-background text-foreground overflow-hidden" style={{ touchAction: 'manipulation' }}>
      <header className="shrink-0 px-4 pb-3 pt-4 sm:px-6 md:px-10 md:pb-4 md:pt-5 relative z-50">
        {/* Mobile Menu Toggle Button */}
        <div className="flex items-center justify-between mb-3 md:hidden">
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-xl font-bold tracking-tight text-foreground"
          >
            Life Scope
          </motion.h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="cursor-pointer p-2 rounded-lg hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>

        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
          {/* Collapsible Content */}
          <motion.div
            initial={false}
            animate={{
              height: mobileMenuOpen ? "auto" : 0,
              opacity: mobileMenuOpen ? 1 : 0,
            }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:!h-auto md:!opacity-100 md:!block"
          >
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)_minmax(260px,1fr)] xl:grid-cols-[minmax(0,1fr)_300px_minmax(280px,1fr)] items-start pb-4 md:pb-0">
            {/* Left column: Title + Input + Mode buttons */}
            <div className="space-y-2 md:col-span-2 lg:col-span-1">
              <div className="space-y-0.5 hidden md:block">
                <motion.h1
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="text-lg sm:text-xl font-bold tracking-tight md:text-2xl"
                >
                  Life Scope
                </motion.h1>
                <p className="text-xs text-muted-foreground">Plan your entire life beautifully.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex h-9 w-full max-w-xl items-center gap-2 rounded-lg border bg-card px-3 shadow-xs">
                  <Input
                    placeholder="Add a task or idea..."
                    className="h-full flex-1 border-0 bg-transparent text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    onFocus={() => setCoachOpen(true)}
                    readOnly
                  />
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Button size="sm" onClick={() => setCoachOpen(true)} className="h-7 shrink-0">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setEmptyHeadOpen(true)} className="h-7 text-xs">
                    Dump Mode
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setPlannerOpen(true)} className="h-7 text-xs">
                    Planner Mode
                  </Button>
                </div>
              </div>
            </div>

            {/* Center column: Gamification + Zoom + Wheel */}
            <div className="flex flex-col items-stretch gap-2 rounded-lg border bg-card p-2.5 shadow-xs relative z-50 md:col-span-1">
              <GamificationHUD summary={xpSummary} />
              <ScopeZoomControl timezone={timezone} />
              <Button variant="outline" size="sm" onClick={() => setWheelOverlayOpen(true)} className="h-7 w-full text-xs">
                View Wheel of Life
              </Button>
            </div>

            {/* Right column: Logout + Capacity */}
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 relative z-50 md:col-span-1 lg:col-span-1">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 text-xs order-2 sm:order-1" title="Log out">
                <LogOut className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
              <CapacityHUD
                scheduledCount={tasks.length}
                capacity={dailyCapacity}
                timezone={timezone}
                selectedDate={selectedDate || date}
                variant="compact"
              />
            </div>
          </div>
          </motion.div>
        </motion.div>
      </header>

      <main className="relative flex-1 min-h-0">
        <CanvasPanWrapper>
          <motion.div
            className="flex items-center justify-center w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: hydrated ? 1 : 0 }}
            style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
          >
            <CircleCanvas
              onSelectBubble={handleSelectBubble}
              onBubbleDrop={handleBubbleDrop}
            />
          </motion.div>
        </CanvasPanWrapper>
        
        {/* Day-by-day timeline - floating element */}
        {hydrated ? (
          <motion.div
            className="fixed left-1/2 transform -translate-x-1/2 z-40 w-[calc(100%-4rem)] sm:w-auto max-w-2xl"
            style={{ bottom: '1.5rem' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <DayByDayTimeline timezone={timezone} />
          </motion.div>
        ) : null}

        {/* Avatar Coach button - fixed bottom left */}
        {hydrated ? (
          <AvatarCoach
            userId={user.id}
            timezone={timezone}
            dailyCapacity={dailyCapacity}
            tasksScheduled={tasks.length}
          />
        ) : null}
      </main>

      <WheelOfLifeOverlay />
      <PaywallDialog totalItemCount={data.totalItemCount} />
      <OnboardingGuide visible={!onboardingComplete} />
      <AreaSheet />
      <EmptyHeadPanel />
      <PlannerOverlay />
    </div>
  );
}

