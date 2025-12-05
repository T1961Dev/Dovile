import { create } from "zustand";

import type { CalendarEvent, Item, LifeArea, Workstream } from "@/types/entities";

export type TimelineMode = "day" | "week" | "quarter" | "year";

type HydrationPayload = {
  date: string;
  areas: LifeArea[];
  workstreams: Workstream[];
  tasks: Item[];
  ideas: Item[];
  events: CalendarEvent[];
};

type DashboardState = {
  selectedDate: string;
  timelineMode: TimelineMode;
  wheelOverlayOpen: boolean;
  areaSheetOpen: string | null;
  selectedBubbleId: string | null;
  selectedBubbleType: "life_area" | "project" | "process" | "task" | "idea" | null;
  coachOpen: boolean;
  paywallOpen: boolean;
  emptyHeadOpen: boolean;
  plannerOpen: boolean;
  currentScopeOpen: boolean;
  visualizationMatrixOpen: boolean;
  areas: LifeArea[];
  workstreams: Workstream[];
  tasks: Item[];
  ideas: Item[];
  events: CalendarEvent[];
  hydrate: (payload: HydrationPayload) => void;
  setSelectedDate: (date: string) => void;
  setTimelineMode: (mode: TimelineMode) => void;
  setWheelOverlayOpen: (open: boolean) => void;
  openAreaSheet: (areaId: string | null) => void;
  openBubbleSheet: (bubbleId: string, bubbleType: "life_area" | "project" | "process" | "task" | "idea") => void;
  closeBubbleSheet: () => void;
  setCoachOpen: (open: boolean) => void;
  setPaywallOpen: (open: boolean) => void;
  setEmptyHeadOpen: (open: boolean) => void;
  setPlannerOpen: (open: boolean) => void;
  setCurrentScopeOpen: (open: boolean) => void;
  setVisualizationMatrixOpen: (open: boolean) => void;
  upsertItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
  setEvents: (events: CalendarEvent[]) => void;
  setWorkstreams: (workstreams: Workstream[]) => void;
  setAreas: (areas: LifeArea[]) => void;
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  selectedDate: "",
  timelineMode: "day",
  wheelOverlayOpen: false,
  areaSheetOpen: null,
  selectedBubbleId: null,
  selectedBubbleType: null,
  coachOpen: false,
  paywallOpen: false,
  emptyHeadOpen: false,
  plannerOpen: false,
  currentScopeOpen: false,
  visualizationMatrixOpen: false,
  areas: [],
  workstreams: [],
  tasks: [],
  ideas: [],
  events: [],
  hydrate: ({ date, areas, workstreams, tasks, ideas, events }) => {
    set({
      selectedDate: date,
      areas,
      workstreams,
      tasks,
      ideas,
      events,
    });
  },
  setSelectedDate: (date) => set({ selectedDate: date }),
  setTimelineMode: (mode) => set({ timelineMode: mode }),
  setWheelOverlayOpen: (open) => set({ wheelOverlayOpen: open }),
  openAreaSheet: (areaId) => set({ areaSheetOpen: areaId }),
  openBubbleSheet: (bubbleId, bubbleType) => {
    set({
      selectedBubbleId: bubbleId,
      selectedBubbleType: bubbleType,
      areaSheetOpen: bubbleId,
    });
  },
  closeBubbleSheet: () => {
    set({
      selectedBubbleId: null,
      selectedBubbleType: null,
      areaSheetOpen: null,
    });
  },
  setCoachOpen: (open) => set({ coachOpen: open }),
  setPaywallOpen: (open) => set({ paywallOpen: open }),
  setEmptyHeadOpen: (open) => set({ emptyHeadOpen: open }),
  setPlannerOpen: (open) => set({ plannerOpen: open }),
  setCurrentScopeOpen: (open) => set({ currentScopeOpen: open }),
  setVisualizationMatrixOpen: (open) => set({ visualizationMatrixOpen: open }),
  upsertItem: (item) => {
    const { tasks, ideas } = get();
    if (item.type === "task") {
      const otherTasks = tasks.filter((existing) => existing.id !== item.id);
      set({ tasks: [...otherTasks, item] });
    } else if (item.type === "idea") {
      const otherIdeas = ideas.filter((existing) => existing.id !== item.id);
      set({ ideas: [...otherIdeas, item] });
    }
  },
  removeItem: (itemId) => {
    const { tasks, ideas } = get();
    set({
      tasks: tasks.filter((item) => item.id !== itemId),
      ideas: ideas.filter((item) => item.id !== itemId),
    });
  },
  setEvents: (events) => set({ events }),
  setWorkstreams: (workstreams) => set({ workstreams }),
  setAreas: (areas) => set({ areas }),
}));

