"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Database } from "@/types/database";

export type BubbleType = "life_area" | "project" | "process" | "task" | "idea" | "vision";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];
type WorkstreamRow = Database["public"]["Tables"]["workstreams"]["Row"];
type LifeAreaRow = Database["public"]["Tables"]["life_areas"]["Row"];

export const RING_CONFIG: Record<
  BubbleType,
  {
    radius: number;
    baseSize: number;
  }
> = {
  life_area: { radius: 260, baseSize: 110 },
  project: { radius: 210, baseSize: 46 },
  process: { radius: 210, baseSize: 46 },
  task: { radius: 150, baseSize: 30 },
  idea: { radius: 230, baseSize: 26 },
  vision: { radius: 320, baseSize: 56 },
};

const CANVAS_SIZE = 640;

const DEFAULT_METADATA: Record<BubbleType, Record<string, unknown>> = {
  life_area: {},
  project: { kind: "project" },
  process: { kind: "process" },
  task: {},
  idea: {},
  vision: {},
};

function polarToNormalized(radius: number, angle: number) {
  const center = CANVAS_SIZE / 2;
  const xPx = Math.cos(angle) * radius + center;
  const yPx = Math.sin(angle) * radius + center;
  return {
    x: xPx / CANVAS_SIZE,
    y: yPx / CANVAS_SIZE,
  };
}

function normalizedToPolar(x?: number, y?: number) {
  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }
  const center = CANVAS_SIZE / 2;
  const xPx = x * CANVAS_SIZE - center;
  const yPx = y * CANVAS_SIZE - center;
  return {
    ring: Math.sqrt(xPx * xPx + yPx * yPx),
    angle: Math.atan2(yPx, xPx),
  };
}

export interface Bubble {
  id: string;
  type: BubbleType;
  lifeAreaId?: string;
  parentId?: string;
  title: string;
  status: string;
  bubbleSize: number;
  bubblePosition: { ring: number; angle: number; x?: number; y?: number };
  metadata: Record<string, unknown>;
}

interface BubbleState {
  bubbles: Record<string, Bubble>;
  zoomLevel: "day" | "week" | "quarter" | "year" | "decade";
  selectedDate: string;
  pinnedBubbleId: string | null;
  localPositions: Record<string, { ring: number; angle: number; x: number; y: number }>;
  currentUserId: string | null;
  hydrateFromServer: (payload: {
    lifeAreas: LifeAreaRow[];
    workstreams: WorkstreamRow[];
    items: ItemRow[];
  }) => void;
  upsertBubble: (bubble: Bubble) => void;
  removeBubble: (id: string) => void;
  setZoomLevel: (zoom: BubbleState["zoomLevel"]) => void;
  setSelectedDate: (date: string) => void;
  setPinnedBubble: (id: string | null) => void;
  updateBubblePosition: (id: string, position: { ring: number; angle: number; x?: number; y?: number }) => void;
  getNextAngle: (
    type: BubbleType,
    options?: { lifeAreaId?: string; parentId?: string; anchorAngle?: number; wedge?: number },
  ) => number;
  forgetLocalPosition: (id: string) => void;
  syncUserContext: (userId: string) => void;
  reset: () => void;
}

function rowToBubble(row: LifeAreaRow | WorkstreamRow | ItemRow): Bubble {
  if ("life_area_id" in row && "user_id" in row && "type" in row && "status" in row) {
    // item
    const type = row.type === "task" ? "task" : "idea";
    const storedPosition = (row.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
    let ring = typeof storedPosition?.ring === "number" ? storedPosition.ring : RING_CONFIG[type].radius;
    let angle = typeof storedPosition?.angle === "number" ? storedPosition.angle : 0;
    const derived = normalizedToPolar(storedPosition?.x, storedPosition?.y);
    if (derived) {
      ring = derived.ring;
      angle = derived.angle;
    }
    const normalized = storedPosition?.x != null && storedPosition?.y != null
      ? { x: storedPosition.x, y: storedPosition.y }
      : polarToNormalized(ring, angle);
    return {
      id: row.id,
      type,
      lifeAreaId: row.life_area_id,
      parentId: row.workstream_id ?? undefined,
      title: row.title,
      status: row.status,
      bubbleSize:
        typeof row.bubble_size === "number" && !Number.isNaN(row.bubble_size)
          ? Number(row.bubble_size)
          : RING_CONFIG[type].baseSize,
      bubblePosition: {
        ring,
        angle,
        x: normalized.x,
        y: normalized.y,
      },
      metadata: {
        scheduledFor: row.scheduled_for,
        notes: row.notes,
        completedAt: row.completed_at,
        __locked: Boolean(storedPosition),
      },
    };
  }

  if ("life_area_id" in row && "kind" in row) {
    const normalizedKind = row.kind === "habit" ? "process" : row.kind;
    const projectKind = normalizedKind as "project" | "process";
    const storedPosition = (row.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
    let ring = typeof storedPosition?.ring === "number" ? storedPosition.ring : RING_CONFIG[projectKind].radius;
    let angle = typeof storedPosition?.angle === "number" ? storedPosition.angle : 0;
    const derived = normalizedToPolar(storedPosition?.x, storedPosition?.y);
    if (derived) {
      ring = derived.ring;
      angle = derived.angle;
    }
    const normalized = storedPosition?.x != null && storedPosition?.y != null
      ? { x: storedPosition.x, y: storedPosition.y }
      : polarToNormalized(ring, angle);
    return {
      id: row.id,
      type: projectKind,
      lifeAreaId: row.life_area_id,
      parentId: undefined,
      title: row.title,
      status: row.active ? "active" : "archived",
      bubbleSize:
        typeof row.bubble_size === "number" && !Number.isNaN(row.bubble_size)
          ? Number(row.bubble_size)
          : RING_CONFIG[projectKind].baseSize,
      bubblePosition: {
        ring,
        angle,
        x: normalized.x,
        y: normalized.y,
      },
      metadata: {
        description: row.description,
        kind: row.kind,
        __locked: Boolean(storedPosition),
      },
    };
  }

  const storedPosition = (row.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
  let ring = typeof storedPosition?.ring === "number" ? storedPosition.ring : RING_CONFIG.life_area.radius;
  let angle = typeof storedPosition?.angle === "number" ? storedPosition.angle : 0;
  const derived = normalizedToPolar(storedPosition?.x, storedPosition?.y);
  if (derived) {
    ring = derived.ring;
    angle = derived.angle;
  }
  const normalized = storedPosition?.x != null && storedPosition?.y != null
    ? { x: storedPosition.x, y: storedPosition.y }
    : polarToNormalized(ring, angle);
  return {
    id: row.id,
    type: "life_area",
    lifeAreaId: row.id,
    title: row.name,
    status: "active",
    bubbleSize:
      typeof row.bubble_size === "number" && !Number.isNaN(row.bubble_size)
        ? Number(row.bubble_size)
        : RING_CONFIG.life_area.baseSize,
    bubblePosition: {
      ring,
      angle,
      x: normalized.x,
      y: normalized.y,
    },
    metadata: {
      color: row.color,
      rating: row.rating,
      visionText: row.vision_text,
      __locked: Boolean(storedPosition),
    },
  };
}

const TWO_PI = Math.PI * 2;

function spreadCluster(
  bubbles: Bubble[],
  centreAngle: number,
  radius: number,
  baseSize: number,
  wedge = Math.PI / 4,
) {
  if (bubbles.length === 0) return;
  const sorted = [...bubbles].sort((a, b) => {
    const angleA = a.bubblePosition?.angle;
    const angleB = b.bubblePosition?.angle;
    if (typeof angleA === "number" && typeof angleB === "number") {
      return angleA - angleB;
    }
    return a.title.localeCompare(b.title);
  });
  if (sorted.length === 1) {
    sorted[0].bubblePosition = { ring: radius, angle: centreAngle };
    sorted[0].bubbleSize = baseSize;
    return;
  }

  // Increase spacing - use larger multiplier for better spread
  const desiredWidth = Math.max(0.6, sorted.length * 0.85);
  let totalWidth = Math.min(wedge, desiredWidth);
  if (wedge > Math.PI && desiredWidth < wedge * 0.9) {
    totalWidth = wedge;
  }
  // Add minimum spacing between bubbles
  const minSpacing = 0.15; // Minimum angle between bubbles
  const calculatedStep = totalWidth / Math.max(1, sorted.length - 1);
  const step = Math.max(calculatedStep, minSpacing);
  const adjustedWidth = step * Math.max(1, sorted.length - 1);
  const start = centreAngle - adjustedWidth / 2;

  sorted.forEach((bubble, index) => {
    const angle = start + index * step;
    const normalized = polarToNormalized(radius, angle);
    bubble.bubblePosition = { ring: radius, angle, x: normalized.x, y: normalized.y };
    bubble.bubbleSize = baseSize;
  });
}

function ensureBubbleDefaults(bubbles: Record<string, Bubble>): Record<string, Bubble> {
  const next: Record<string, Bubble> = {};

  Object.values(bubbles).forEach((bubble) => {
    const position = bubble.bubblePosition ?? {
      ring: RING_CONFIG[bubble.type].radius,
      angle: 0,
    };
    const normalized =
      position.x != null && position.y != null
        ? { x: position.x, y: position.y }
        : polarToNormalized(position.ring, position.angle);
    next[bubble.id] = {
      ...bubble,
      bubbleSize: bubble.bubbleSize ?? RING_CONFIG[bubble.type].baseSize,
      bubblePosition: {
        ring: position.ring,
        angle: position.angle,
        x: normalized.x,
        y: normalized.y,
      },
      metadata: {
        ...DEFAULT_METADATA[bubble.type],
        ...bubble.metadata,
      },
    };
  });

  const lifeAreas = Object.values(next).filter((bubble) => bubble.type === "life_area");
  const lifeAreaAngles = new Map<string, number>();

  if (lifeAreas.length > 0) {
    const radius = RING_CONFIG.life_area.radius;
    const baseSize = RING_CONFIG.life_area.baseSize;
    const step = TWO_PI / lifeAreas.length;
    lifeAreas.forEach((bubble, index) => {
      const key = bubble.lifeAreaId ?? bubble.id;
      if (bubble.metadata?.__locked && bubble.bubblePosition) {
        lifeAreaAngles.set(key, bubble.bubblePosition.angle);
        return;
      }
      const angle = index * step - Math.PI / 2;
      const normalized = polarToNormalized(radius, angle);
      bubble.bubblePosition = { ring: radius, angle, x: normalized.x, y: normalized.y };
      bubble.bubbleSize = baseSize;
      lifeAreaAngles.set(key, angle);
    });
  }

  const bubbleById = new Map<string, Bubble>(Object.values(next).map((bubble) => [bubble.id, bubble]));

  lifeAreaAngles.forEach((angle, lifeAreaId) => {
    const projects = Object.values(next).filter(
      (bubble) => bubble.lifeAreaId === lifeAreaId && (bubble.type === "project" || bubble.type === "process"),
    );
    const adjustableProjects = projects.filter(
      (bubble) => !(bubble.metadata?.__manualPosition && bubble.bubblePosition?.x != null && bubble.bubblePosition?.y != null),
    );
    spreadCluster(adjustableProjects, angle, RING_CONFIG.project.radius, RING_CONFIG.project.baseSize, Math.PI / 6);

    const ideas = Object.values(next).filter(
      (bubble) => bubble.lifeAreaId === lifeAreaId && bubble.type === "idea",
    );
    const adjustableIdeas = ideas.filter((bubble) => !(bubble.metadata?.__manualPosition && bubble.bubblePosition?.x != null && bubble.bubblePosition?.y != null));
    spreadCluster(adjustableIdeas, angle, RING_CONFIG.idea.radius, RING_CONFIG.idea.baseSize, Math.PI / 5);
  });

  const unassignedIdeas = Object.values(next).filter(
    (bubble) => bubble.type === "idea" && !bubble.lifeAreaId,
  );
  spreadCluster(unassignedIdeas, -Math.PI / 2, RING_CONFIG.idea.radius, RING_CONFIG.idea.baseSize, TWO_PI - 0.2);

  const tasks = Object.values(next).filter((bubble) => bubble.type === "task");

  const taskGroups = new Map<string, Bubble[]>();
  tasks.forEach((task) => {
    const parent = task.parentId ? bubbleById.get(task.parentId) : undefined;
    const key = parent?.id ?? task.lifeAreaId ?? "ungrouped";
    if (!taskGroups.has(key)) {
      taskGroups.set(key, []);
    }
    taskGroups.get(key)!.push(task);
  });

  taskGroups.forEach((group, key) => {
    let centreAngle = 0;
    if (bubbleById.has(key)) {
      centreAngle = bubbleById.get(key)!.bubblePosition?.angle ?? 0;
    } else if (lifeAreaAngles.has(key)) {
      centreAngle = lifeAreaAngles.get(key)!;
    } else if (key === "ungrouped") {
      centreAngle = -Math.PI / 2;
    }
    const wedge = key === "ungrouped" ? TWO_PI - 0.2 : Math.PI / 7;
    const adjustableTasks = group.filter((bubble) => !(bubble.metadata?.__manualPosition && bubble.bubblePosition?.x != null && bubble.bubblePosition?.y != null));
    spreadCluster(adjustableTasks, centreAngle, RING_CONFIG.task.radius, RING_CONFIG.task.baseSize, wedge);
  });

  return next;
}

export const useBubbleStore = create<BubbleState>()(
  persist(
    (set, get) => ({
      bubbles: {},
      zoomLevel: "day",
      selectedDate: new Date().toISOString().slice(0, 10),
      pinnedBubbleId: null,
      localPositions: {},
      currentUserId: null,
      hydrateFromServer: ({ lifeAreas, workstreams, items }) => {
        const state = get();
        const localPositions = state.localPositions;
        const existingBubbles = state.bubbles;
        const mapped: Record<string, Bubble> = {};
        
        // Preserve existing bubbles that are locked (newly created items)
        Object.values(existingBubbles).forEach((bubble) => {
          if (bubble.metadata?.__locked) {
            mapped[bubble.id] = bubble;
          }
        });
        
        lifeAreas.forEach((row) => {
          const bubble = rowToBubble(row);
          if (!row.bubble_position && localPositions[bubble.id]) {
            bubble.bubblePosition = localPositions[bubble.id]!;
            bubble.metadata = {
              ...bubble.metadata,
              __locked: true,
            };
          }
          // Only overwrite if not already locked
          if (!mapped[bubble.id]?.metadata?.__locked) {
            mapped[bubble.id] = bubble;
          }
        });
        workstreams.forEach((row) => {
          const bubble = rowToBubble(row);
          if (!row.bubble_position && localPositions[bubble.id]) {
            bubble.bubblePosition = localPositions[bubble.id]!;
            bubble.metadata = {
              ...bubble.metadata,
              __locked: true,
            };
          }
          // Only overwrite if not already locked
          if (!mapped[bubble.id]?.metadata?.__locked) {
            mapped[bubble.id] = bubble;
          }
        });
        items.forEach((row) => {
          const bubble = rowToBubble(row);
          if (!row.bubble_position && localPositions[bubble.id]) {
            bubble.bubblePosition = localPositions[bubble.id]!;
            bubble.metadata = {
              ...bubble.metadata,
              __locked: true,
            };
          }
          // Only overwrite if not already locked
          if (!mapped[bubble.id]?.metadata?.__locked) {
            mapped[bubble.id] = bubble;
          }
        });
        set({ bubbles: ensureBubbleDefaults(mapped) });
      },
      upsertBubble: (bubble) =>
        set((state) => {
          const next = {
            ...state.bubbles,
            [bubble.id]: {
              ...bubble,
              bubbleSize: bubble.bubbleSize ?? RING_CONFIG[bubble.type].baseSize,
              bubblePosition: bubble.bubblePosition ?? {
                ring: RING_CONFIG[bubble.type].radius,
                angle: 0,
              },
              metadata: {
                ...DEFAULT_METADATA[bubble.type],
                ...bubble.metadata,
              },
            },
          };
          return { bubbles: ensureBubbleDefaults(next) };
        }),
      removeBubble: (id) =>
        set((state) => {
          const next = { ...state.bubbles };
          delete next[id];
          const positions = { ...state.localPositions };
          delete positions[id];
          return { bubbles: ensureBubbleDefaults(next), localPositions: positions };
        }),
      setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setPinnedBubble: (id) => set({ pinnedBubbleId: id }),
      updateBubblePosition: (id, position) =>
        set((state) => {
          const bubble = state.bubbles[id];
          if (!bubble) return { bubbles: state.bubbles };
          const normalized =
            position.x != null && position.y != null
              ? { x: position.x, y: position.y }
              : polarToNormalized(position.ring, position.angle);
          const newPosition = {
            ring: position.ring,
            angle: position.angle,
            x: normalized.x,
            y: normalized.y,
          };
          return {
            bubbles: {
              ...state.bubbles,
              [id]: {
                ...bubble,
                bubblePosition: newPosition,
                metadata: {
                  ...bubble.metadata,
                  __locked: true,
                },
              },
            },
            localPositions: {
              ...state.localPositions,
              [id]: newPosition,
            },
          };
        }),
      getNextAngle: (type, options = {}) => {
        const state = get();
        const { lifeAreaId, parentId, anchorAngle, wedge } = options;
        const bubbles = Object.values(state.bubbles).filter((candidate) => {
          if (candidate.type !== type) return false;
          switch (type) {
            case "life_area":
              return true;
            case "project":
            case "process":
              return candidate.lifeAreaId === lifeAreaId;
            case "task":
              return (
                (candidate.parentId ?? candidate.lifeAreaId ?? "ungrouped") ===
                (parentId ?? lifeAreaId ?? "ungrouped")
              );
            case "idea":
              if (parentId) {
                return candidate.parentId === parentId;
              }
              return candidate.lifeAreaId === lifeAreaId;
            default:
              return true;
          }
        });
        const angles = bubbles
          .map((bubble) => bubble.bubblePosition?.angle)
          .filter((angle): angle is number => typeof angle === "number");

        const fallbackAnchor =
          anchorAngle ??
          (() => {
            if (type === "life_area") return -Math.PI / 2;
            if (type === "project" || type === "process") {
              const area = lifeAreaId ? state.bubbles[lifeAreaId] : undefined;
              return area?.bubblePosition?.angle ?? -Math.PI / 2;
            }
            if (type === "task" || type === "idea") {
              const parent = parentId ? state.bubbles[parentId] : undefined;
              if (parent?.bubblePosition) return parent.bubblePosition.angle;
              const area = lifeAreaId ? state.bubbles[lifeAreaId] : undefined;
              return area?.bubblePosition?.angle ?? -Math.PI / 2;
            }
            return -Math.PI / 2;
          })();

        const arc = wedge ?? (() => {
          if (type === "life_area") return TWO_PI;
          if (type === "project" || type === "process") return Math.PI / 2;
          if (type === "task") return Math.PI / 3;
          if (type === "idea") return Math.PI / 2;
          return TWO_PI;
        })();

        return computeNextAngle(angles, fallbackAnchor, arc);
      },
      forgetLocalPosition: (id) =>
        set((state) => {
          const positions = { ...state.localPositions };
          delete positions[id];
          return { localPositions: positions };
        }),
      syncUserContext: (userId) =>
        set((state) => {
          if (state.currentUserId === userId) {
            return {};
          }
          const today = new Date().toISOString().slice(0, 10);
          return {
            currentUserId: userId,
            bubbles: {},
            localPositions: {},
            pinnedBubbleId: null,
            zoomLevel: "day",
            selectedDate: today,
          };
        }),
      reset: () =>
        set({
          bubbles: {},
          zoomLevel: "day",
          selectedDate: new Date().toISOString().slice(0, 10),
          pinnedBubbleId: null,
          localPositions: {},
          currentUserId: null,
        }),
    }),
    {
      name: "life-scope-bubbles",
      partialize: (state) => ({
        bubbles: state.bubbles,
        zoomLevel: state.zoomLevel,
        selectedDate: state.selectedDate,
        pinnedBubbleId: state.pinnedBubbleId,
        localPositions: state.localPositions,
        currentUserId: state.currentUserId,
      }),
    },
  ),
);

function normalizeAngle(angle: number): number {
  let result = angle;
  while (result <= -Math.PI) result += TWO_PI;
  while (result > Math.PI) result -= TWO_PI;
  return result;
}

function shortestAngleDiff(a: number, b: number): number {
  const diff = normalizeAngle(a) - normalizeAngle(b);
  return normalizeAngle(diff);
}

function computeNextAngle(angles: number[], anchorAngle: number, wedge: number): number {
  if (angles.length === 0) {
    return normalizeAngle(anchorAngle);
  }

  const sorted = angles.map(normalizeAngle).sort((a, b) => a - b);
  let bestCandidate = normalizeAngle(anchorAngle);
  let bestScore = -Infinity;

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    const next = index === sorted.length - 1 ? sorted[0]! + TWO_PI : sorted[index + 1]!;
    const gap = next - current;
    if (gap <= 0.01) continue;
    const midpoint = current + gap / 2;
    const candidate = normalizeAngle(midpoint);

    const distanceToAnchor = Math.abs(shortestAngleDiff(candidate, anchorAngle));
    if (wedge < TWO_PI && distanceToAnchor > wedge / 2) {
      continue;
    }

    const score = gap - distanceToAnchor * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return normalizeAngle(bestCandidate);
}


