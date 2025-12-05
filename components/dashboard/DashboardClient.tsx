"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { Pencil, LogOut } from "lucide-react";

import { AvatarCoach } from "@/components/AvatarCoach";
import { AreaSheet } from "@/components/AreaSheet";
import { CapacityHUD } from "@/components/CapacityHUD";
import { GamificationHUD } from "@/components/GamificationHUD";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { PaywallDialog } from "@/components/PaywallDialog";
import { TimelineView } from "@/components/TimelineView";
import { WheelOfLifeOverlay } from "@/components/WheelOfLifeOverlay";
import { EmptyHeadPanel } from "@/components/dashboard/EmptyHeadPanel";
import { PlannerOverlay } from "@/components/dashboard/PlannerOverlay";
import { CurrentScopeView } from "@/components/dashboard/CurrentScopeView";
import { VisualizationMatrix } from "@/components/dashboard/VisualizationMatrix";
import { ScopeZoomControl } from "@/components/ScopeZoomControl";
import { SocialFeatures } from "@/components/SocialFeatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/store/useDashboardStore";
import { CircleCanvas } from "@/components/CircleCanvas";
import { RING_CONFIG, useBubbleStore } from "@/store/bubbles";
import type { BubbleType, Bubble } from "@/store/bubbles";
import type { BubbleDropResult } from "@/components/CircleCanvas";
import { AIInsightPanel } from "@/components/AIInsightPanel";
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
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleGlobalMouseMove, handleMouseUp]);

  return (
    <>
      <div
        ref={containerRef}
        className="relative"
        style={{ 
          cursor: panRef.current.isPanning ? 'grabbing' : 'grab',
          touchAction: 'none',
          willChange: panRef.current.isPanning ? 'transform' : 'auto',
          width: '100%',
          height: '100%'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => handleMouseMove(e as any)}
        onMouseUp={handleMouseUp}
      >
        {children}
      </div>
      {/* Reset View Button */}
      {(panPosition.x !== 0 || panPosition.y !== 0) && (
        <button
          onClick={resetView}
          className="fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg border border-[#0EA8A8]/30 hover:bg-[#0EA8A8]/10 transition-colors"
          title="Reset view to center"
          aria-label="Reset view"
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
            className="text-[#0EA8A8]"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      )}
    </>
  );
}

type ItemRow = Database["public"]["Tables"]["items"]["Row"];

const CANVAS_SIZE = 640;
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
      : { x: (Math.cos(angle) * ring + 320) / 640, y: (Math.sin(angle) * ring + 320) / 640 };

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
    const baseCoords = {
      x: 320 + Math.cos(angle) * RING_CONFIG[bubble.type].radius,
      y: 320 + Math.sin(angle) * RING_CONFIG[bubble.type].radius,
    };

    const coordsForType = (type: BubbleType, customAngle = angle) => ({
      x: 320 + Math.cos(customAngle) * RING_CONFIG[type].radius,
      y: 320 + Math.sin(customAngle) * RING_CONFIG[type].radius,
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
            const CANVAS_SIZE = 640;
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
            const CANVAS_SIZE = 640;
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
    <div className="relative flex min-h-screen flex-col bg-[#FBF9F4] text-[#0B1918]" style={{ overflow: 'visible' }}>
      <header className="px-6 pb-8 pt-10 sm:px-10 relative z-50">
        <motion.div
          className="flex flex-col gap-8"
          initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.9fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_280px_minmax(0,1fr)] items-start">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <motion.h1
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="text-3xl font-semibold tracking-tight text-[#0B1918] sm:text-[2.5rem]"
                  >
                    Life Scope
                  </motion.h1>
                  <p className="text-sm text-[#195552]">Plan your entire life beautifully.</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="h-9 rounded-full px-3 text-xs font-semibold text-[#195552] hover:text-[#0B1918] hover:bg-[#0EA8A8]/10"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex h-11 w-full max-w-xl items-center gap-3 rounded-full border border-[#0EA8A8]/25 bg-white px-4 shadow-[0_10px_24px_-20px_rgba(15,75,68,0.35)]">
                  <Input
                    placeholder="Add a task or idea..."
                    className="h-full flex-1 border-0 bg-transparent text-sm text-[#0B1918] placeholder:text-[#0EA8A8]/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                    onFocus={() => setCoachOpen(true)}
                    readOnly
                  />
                  <Pencil className="h-4 w-4 text-[#0EA8A8]" />
                  <Button
                    onClick={() => setCoachOpen(true)}
                    className="h-9 rounded-full bg-[#FFD833] px-5 text-sm font-semibold text-[#0B1918] shadow-sm transition hover:bg-[#FECB32]"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEmptyHeadOpen(true)}
                    className="h-9 rounded-full border-[#0EA8A8]/30 bg-white px-4 text-xs font-semibold text-[#0EA8A8] hover:border-[#0EA8A8]/60"
                  >
                    DUMP MODE
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPlannerOpen(true)}
                    className="h-9 rounded-full border-[#FFD833]/50 bg-[#FFF4DB] px-4 text-xs font-semibold text-[#0B1918] hover:border-[#FFD833]/70"
                  >
                    PLANNER MODE
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const setCurrentScopeOpen = useDashboardStore.getState().setCurrentScopeOpen;
                      setCurrentScopeOpen(true);
                    }}
                    className="h-9 rounded-full border-[#8F8CF5]/50 bg-[#DED6FF]/30 px-4 text-xs font-semibold text-[#8F8CF5] hover:border-[#8F8CF5]/70"
                  >
                    Current Scope
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const setVisualizationMatrixOpen = useDashboardStore.getState().setVisualizationMatrixOpen;
                      setVisualizationMatrixOpen(true);
                    }}
                    className="h-9 rounded-full border-[#28B7A3]/50 bg-[#7FE5D1]/30 px-4 text-xs font-semibold text-[#28B7A3] hover:border-[#28B7A3]/70"
                  >
                    Vision Matrix
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-3xl border border-[#0EA8A8]/20 bg-white/80 px-5 py-4 shadow-[0_18px_45px_-30px_rgba(14,168,168,0.45)] backdrop-blur-sm relative z-50">
              <GamificationHUD summary={xpSummary} />
              <ScopeZoomControl timezone={timezone} />
              <Button
                variant="outline"
                onClick={() => setWheelOverlayOpen(true)}
                className="h-9 rounded-full border-[#0EA8A8]/40 px-5 text-xs font-semibold text-[#0EA8A8] hover:border-[#0EA8A8]/70"
              >
                View Wheel
              </Button>
            </div>

            <div className="flex flex-col items-end gap-3 relative z-50">
              <CapacityHUD
                scheduledCount={tasks.length}
                capacity={dailyCapacity}
                timezone={timezone}
                selectedDate={selectedDate || date}
                variant="compact"
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setCoachOpen(true)}
                  className="h-9 rounded-full bg-[#FFD833] px-4 text-xs font-semibold text-[#0B1918] shadow-sm transition hover:bg-[#FFC300]"
                >
                  Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCoachOpen(true)}
                  className="h-9 rounded-full border-[#DED6FF]/60 bg-white px-4 text-xs font-semibold text-[#5C4FD0] hover:border-[#C5B8FF]"
                >
                  Open Coach
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </header>

      <main className="relative flex-1 pb-24" style={{ position: 'relative', overflow: 'visible', width: '100%', height: '100%' }}>
        <CanvasPanWrapper>
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-8 px-4 sm:px-6" style={{ position: 'relative', minHeight: '100vh', width: '100%' }}>
            <motion.section
              className="relative flex flex-1 items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: hydrated ? 1 : 0 }}
            >
              <CircleCanvas
                onSelectBubble={handleSelectBubble}
                onBubbleDrop={handleBubbleDrop}
              />
              {hydrated ? (
                <AvatarCoach
                  userId={user.id}
                  timezone={timezone}
                  dailyCapacity={dailyCapacity}
                  tasksScheduled={tasks.length}
                />
              ) : null}
            </motion.section>

          </div>
        </CanvasPanWrapper>
        
        {/* Timeline locked to bottom center - like inventory bar */}
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-5xl z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: hydrated ? 1 : 0, y: hydrated ? 0 : 12 }}
            >
              <TimelineView timezone={timezone} />
            </motion.div>
          </div>
        </div>
      </main>

      <WheelOfLifeOverlay />
      <PaywallDialog totalItemCount={data.totalItemCount} />
      <OnboardingGuide visible={!onboardingComplete} />
      <AreaSheet />
      <EmptyHeadPanel />
      <PlannerOverlay />
      <CurrentScopeView />
      <VisualizationMatrix />
    </div>
  );
}

