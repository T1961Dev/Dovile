"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Database } from "@/types/database";

export type BubbleType = "life_area" | "project" | "process" | "task" | "idea" | "vision";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];
type WorkstreamRow = Database["public"]["Tables"]["workstreams"]["Row"];
type LifeAreaRow = Database["public"]["Tables"]["life_areas"]["Row"];

// ─── Layout geometry ───────────────────────────────────────────
// Canvas is 900×900 logical pixels. Center = 450,450.
// This gives plenty of room for 8+ life areas with projects/tasks/ideas.
export const CANVAS_SIZE = 900;

export const RING_CONFIG: Record<BubbleType, { radius: number; baseSize: number }> = {
  life_area: { radius: 220, baseSize: 100 },  // Large circles on inner ring
  project:   { radius: 320, baseSize: 40 },   // Medium circles, well separated from life areas
  process:   { radius: 320, baseSize: 40 },
  task:      { radius: 390, baseSize: 24 },   // Small dots
  idea:      { radius: 430, baseSize: 18 },   // Smallest dots on outer edge
  vision:    { radius: 390, baseSize: 44 },
};

// Schema version - bump this whenever RING_CONFIG changes to force re-layout
const LAYOUT_VERSION = 5;

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
  return {
    x: (Math.cos(angle) * radius + center) / CANVAS_SIZE,
    y: (Math.sin(angle) * radius + center) / CANVAS_SIZE,
  };
}

function normalizedToPolar(x?: number, y?: number) {
  if (typeof x !== "number" || typeof y !== "number") return null;
  const center = CANVAS_SIZE / 2;
  const xPx = x * CANVAS_SIZE - center;
  const yPx = y * CANVAS_SIZE - center;
  return { ring: Math.sqrt(xPx * xPx + yPx * yPx), angle: Math.atan2(yPx, xPx) };
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
  canvasZoom: number;
  layoutVersion: number;
  hydrateFromServer: (payload: { lifeAreas: LifeAreaRow[]; workstreams: WorkstreamRow[]; items: ItemRow[] }) => void;
  upsertBubble: (bubble: Bubble) => void;
  removeBubble: (id: string) => void;
  setZoomLevel: (zoom: BubbleState["zoomLevel"]) => void;
  setSelectedDate: (date: string) => void;
  setPinnedBubble: (id: string | null) => void;
  setCanvasZoom: (zoom: number) => void;
  updateBubblePosition: (id: string, position: { ring: number; angle: number; x?: number; y?: number }) => void;
  getNextAngle: (type: BubbleType, options?: { lifeAreaId?: string; parentId?: string; anchorAngle?: number; wedge?: number }) => number;
  forgetLocalPosition: (id: string) => void;
  syncUserContext: (userId: string) => void;
  reset: () => void;
}

// ─── Row → Bubble converters ──────────────────────────────────
function rowToBubble(row: LifeAreaRow | WorkstreamRow | ItemRow, forceRelayout: boolean): Bubble {
  // Item (task / idea)
  if ("life_area_id" in row && "user_id" in row && "type" in row && "status" in row) {
    const type = row.type === "task" ? "task" : "idea";
    const config = RING_CONFIG[type];
    // If we're forcing re-layout, ignore stored positions
    const storedPos = forceRelayout ? null : (row.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
    let ring = config.radius;
    let angle = 0;
    if (storedPos) {
      ring = typeof storedPos.ring === "number" ? storedPos.ring : config.radius;
      angle = typeof storedPos.angle === "number" ? storedPos.angle : 0;
      const derived = normalizedToPolar(storedPos.x, storedPos.y);
      if (derived) { ring = derived.ring; angle = derived.angle; }
    }
    const norm = storedPos?.x != null && storedPos?.y != null && !forceRelayout
      ? { x: storedPos.x, y: storedPos.y }
      : polarToNormalized(ring, angle);
    return {
      id: row.id, type, lifeAreaId: row.life_area_id, parentId: row.workstream_id ?? undefined,
      title: row.title, status: row.status,
      bubbleSize: config.baseSize,
      bubblePosition: { ring, angle, x: norm.x, y: norm.y },
      metadata: { scheduledFor: row.scheduled_for, notes: row.notes, completedAt: row.completed_at, __locked: !forceRelayout && Boolean(storedPos) },
    };
  }

  // Workstream (project / process)
  if ("life_area_id" in row && "kind" in row) {
    const kind = (row.kind === "habit" ? "process" : row.kind) as "project" | "process";
    const config = RING_CONFIG[kind];
    const storedPos = forceRelayout ? null : (row.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
    let ring = config.radius;
    let angle = 0;
    if (storedPos) {
      ring = typeof storedPos.ring === "number" ? storedPos.ring : config.radius;
      angle = typeof storedPos.angle === "number" ? storedPos.angle : 0;
      const derived = normalizedToPolar(storedPos.x, storedPos.y);
      if (derived) { ring = derived.ring; angle = derived.angle; }
    }
    const norm = storedPos?.x != null && storedPos?.y != null && !forceRelayout
      ? { x: storedPos.x, y: storedPos.y }
      : polarToNormalized(ring, angle);
    return {
      id: row.id, type: kind, lifeAreaId: row.life_area_id, parentId: undefined,
      title: row.title, status: row.active ? "active" : "archived",
      bubbleSize: config.baseSize,
      bubblePosition: { ring, angle, x: norm.x, y: norm.y },
      metadata: { description: row.description, kind: row.kind, __locked: !forceRelayout && Boolean(storedPos) },
    };
  }

  // Life area
  const config = RING_CONFIG.life_area;
  const storedPos = forceRelayout ? null : (row.bubble_position as { ring?: number; angle?: number; x?: number; y?: number } | null) ?? null;
  let ring = config.radius;
  let angle = 0;
  if (storedPos) {
    ring = typeof storedPos.ring === "number" ? storedPos.ring : config.radius;
    angle = typeof storedPos.angle === "number" ? storedPos.angle : 0;
    const derived = normalizedToPolar(storedPos.x, storedPos.y);
    if (derived) { ring = derived.ring; angle = derived.angle; }
  }
  const norm = storedPos?.x != null && storedPos?.y != null && !forceRelayout
    ? { x: storedPos.x, y: storedPos.y }
    : polarToNormalized(ring, angle);
  return {
    id: row.id, type: "life_area", lifeAreaId: row.id,
    title: row.name, status: "active",
    bubbleSize: config.baseSize,
    bubblePosition: { ring, angle, x: norm.x, y: norm.y },
    metadata: { color: row.color, rating: row.rating, visionText: row.vision_text, __locked: !forceRelayout && Boolean(storedPos) },
  };
}

// ─── Spread helpers ───────────────────────────────────────────
const TWO_PI = Math.PI * 2;

function spreadCluster(
  bubbles: Bubble[],
  centreAngle: number,
  radius: number,
  baseSize: number,
  wedge = Math.PI / 4,
) {
  if (bubbles.length === 0) return;
  if (bubbles.length === 1) {
    const n = polarToNormalized(radius, centreAngle);
    bubbles[0].bubblePosition = { ring: radius, angle: centreAngle, x: n.x, y: n.y };
    bubbles[0].bubbleSize = baseSize;
    return;
  }

  // Calculate minimum angular spacing to prevent overlap
  // Arc distance between centers should be >= baseSize * 1.4
  const minAngle = (baseSize * 1.4) / radius;
  const neededWidth = (bubbles.length - 1) * minAngle;
  // Use the larger of: requested wedge, or needed width (capped at nearly full circle)
  const totalWidth = Math.min(TWO_PI - 0.3, Math.max(wedge, neededWidth));
  const step = totalWidth / Math.max(1, bubbles.length - 1);
  const start = centreAngle - totalWidth / 2;

  const sorted = [...bubbles].sort((a, b) => {
    const aA = a.bubblePosition?.angle;
    const bA = b.bubblePosition?.angle;
    if (typeof aA === "number" && typeof bA === "number") return aA - bA;
    return a.title.localeCompare(b.title);
  });

  sorted.forEach((bubble, i) => {
    const angle = start + i * step;
    const n = polarToNormalized(radius, angle);
    bubble.bubblePosition = { ring: radius, angle, x: n.x, y: n.y };
    bubble.bubbleSize = baseSize;
  });
}

// ─── Default layout ───────────────────────────────────────────
function ensureBubbleDefaults(bubbles: Record<string, Bubble>): Record<string, Bubble> {
  const next: Record<string, Bubble> = {};

  // 1. Copy all with defaults
  Object.values(bubbles).forEach((b) => {
    const pos = b.bubblePosition ?? { ring: RING_CONFIG[b.type].radius, angle: 0 };
    const norm = pos.x != null && pos.y != null ? { x: pos.x, y: pos.y } : polarToNormalized(pos.ring, pos.angle);
    next[b.id] = {
      ...b,
      bubbleSize: RING_CONFIG[b.type].baseSize, // Always use config size
      bubblePosition: { ring: pos.ring, angle: pos.angle, x: norm.x, y: norm.y },
      metadata: { ...DEFAULT_METADATA[b.type], ...b.metadata },
    };
  });

  // 2. Position life areas evenly around center
  const lifeAreas = Object.values(next).filter((b) => b.type === "life_area");
  const lifeAreaAngles = new Map<string, number>();
  const laRadius = RING_CONFIG.life_area.radius;
  const laSize = RING_CONFIG.life_area.baseSize;

  if (lifeAreas.length > 0) {
    const step = TWO_PI / lifeAreas.length;
    lifeAreas.forEach((b, i) => {
      const key = b.lifeAreaId ?? b.id;
      if (b.metadata?.__locked && b.bubblePosition) {
        lifeAreaAngles.set(key, b.bubblePosition.angle);
        return;
      }
      const angle = i * step - Math.PI / 2; // Start from top
      const n = polarToNormalized(laRadius, angle);
      b.bubblePosition = { ring: laRadius, angle, x: n.x, y: n.y };
      b.bubbleSize = laSize;
      lifeAreaAngles.set(key, angle);
    });
  }

  const isManual = (b: Bubble) => b.metadata?.__manualPosition && b.bubblePosition?.x != null;

  // 3. Position projects/processes on their ring, clustered near parent life area
  lifeAreaAngles.forEach((laAngle, laId) => {
    const projects = Object.values(next).filter(
      (b) => b.lifeAreaId === laId && (b.type === "project" || b.type === "process"),
    );
    const adjustable = projects.filter((b) => !isManual(b));
    // Give each project cluster a wedge proportional to count, but at least PI/6
    const wedge = Math.max(Math.PI / 6, projects.length * 0.15);
    spreadCluster(adjustable, laAngle, RING_CONFIG.project.radius, RING_CONFIG.project.baseSize, wedge);
  });

  // Build project lookup
  const projectById = new Map<string, Bubble>();
  Object.values(next).forEach((b) => {
    if (b.type === "project" || b.type === "process") projectById.set(b.id, b);
  });

  // 4. Position tasks
  const groupBy = (list: Bubble[], keyFn: (b: Bubble) => string | undefined) => {
    const map = new Map<string, Bubble[]>();
    list.forEach((b) => { const k = keyFn(b); if (!k) return; if (!map.has(k)) map.set(k, []); map.get(k)!.push(b); });
    return map;
  };

  const tasks = Object.values(next).filter((b) => b.type === "task");
  const tasksByProject = groupBy(tasks.filter((t) => t.parentId && projectById.has(t.parentId!)), (b) => b.parentId);
  const tasksByArea = groupBy(tasks.filter((t) => !t.parentId || !projectById.has(t.parentId!)), (b) => b.lifeAreaId);

  tasksByProject.forEach((group, pid) => {
    const p = projectById.get(pid);
    if (!p) return;
    const adj = group.filter((b) => !isManual(b));
    spreadCluster(adj, p.bubblePosition?.angle ?? 0, RING_CONFIG.task.radius, RING_CONFIG.task.baseSize, Math.max(Math.PI / 8, group.length * 0.1));
  });

  tasksByArea.forEach((group, laId) => {
    const adj = group.filter((b) => !isManual(b));
    spreadCluster(adj, lifeAreaAngles.get(laId) ?? 0, RING_CONFIG.task.radius, RING_CONFIG.task.baseSize, Math.max(Math.PI / 6, group.length * 0.1));
  });

  // 5. Position ideas
  const ideas = Object.values(next).filter((b) => b.type === "idea");
  const ideasByProject = groupBy(ideas.filter((b) => b.parentId && projectById.has(b.parentId!)), (b) => b.parentId);
  const ideasByArea = groupBy(ideas.filter((b) => !b.parentId || !projectById.has(b.parentId!)), (b) => b.lifeAreaId);

  ideasByProject.forEach((group, pid) => {
    const p = projectById.get(pid);
    if (!p) return;
    const adj = group.filter((b) => !isManual(b));
    spreadCluster(adj, p.bubblePosition?.angle ?? 0, RING_CONFIG.idea.radius, RING_CONFIG.idea.baseSize, Math.max(Math.PI / 8, group.length * 0.1));
  });

  ideasByArea.forEach((group, laId) => {
    const adj = group.filter((b) => !isManual(b));
    spreadCluster(adj, lifeAreaAngles.get(laId) ?? 0, RING_CONFIG.idea.radius, RING_CONFIG.idea.baseSize, Math.max(Math.PI / 6, group.length * 0.1));
  });

  // Unassigned
  const unassigned = (type: BubbleType) => Object.values(next).filter((b) => b.type === type && !b.lifeAreaId);
  spreadCluster(unassigned("idea").filter((b) => !isManual(b)), -Math.PI / 2, RING_CONFIG.idea.radius, RING_CONFIG.idea.baseSize, TWO_PI - 0.3);
  spreadCluster(unassigned("task").filter((b) => !isManual(b)), -Math.PI / 2, RING_CONFIG.task.radius, RING_CONFIG.task.baseSize, TWO_PI - 0.3);

  return next;
}

// ─── Store ────────────────────────────────────────────────────
export const useBubbleStore = create<BubbleState>()(
  persist(
    (set, get) => ({
      bubbles: {},
      zoomLevel: "day",
      selectedDate: new Date().toISOString().slice(0, 10),
      pinnedBubbleId: null,
      localPositions: {},
      currentUserId: null,
      canvasZoom: 0.7,
      layoutVersion: 0,

      hydrateFromServer: ({ lifeAreas, workstreams, items }) => {
        const state = get();
        // If layout version is stale, force a fresh layout (ignore all stored positions)
        const forceRelayout = state.layoutVersion !== LAYOUT_VERSION;
        const mapped: Record<string, Bubble> = {};

        // Only preserve locked bubbles if layout version matches
        if (!forceRelayout) {
          Object.values(state.bubbles).forEach((b) => {
            if (b.metadata?.__locked) mapped[b.id] = b;
          });
        }

        lifeAreas.forEach((row) => {
          const b = rowToBubble(row, forceRelayout);
          if (!forceRelayout && !row.bubble_position && state.localPositions[b.id]) {
            b.bubblePosition = state.localPositions[b.id]!;
            b.metadata = { ...b.metadata, __locked: true };
          }
          if (!mapped[b.id]?.metadata?.__locked || forceRelayout) mapped[b.id] = b;
        });
        workstreams.forEach((row) => {
          const b = rowToBubble(row, forceRelayout);
          if (!forceRelayout && !row.bubble_position && state.localPositions[b.id]) {
            b.bubblePosition = state.localPositions[b.id]!;
            b.metadata = { ...b.metadata, __locked: true };
          }
          if (!mapped[b.id]?.metadata?.__locked || forceRelayout) mapped[b.id] = b;
        });
        items.forEach((row) => {
          const b = rowToBubble(row, forceRelayout);
          if (!forceRelayout && !row.bubble_position && state.localPositions[b.id]) {
            b.bubblePosition = state.localPositions[b.id]!;
            b.metadata = { ...b.metadata, __locked: true };
          }
          if (!mapped[b.id]?.metadata?.__locked || forceRelayout) mapped[b.id] = b;
        });

        const finalBubbles = ensureBubbleDefaults(mapped);

        // Persist all computed positions to localPositions so they survive page
        // reloads.  Without this, bubbles whose DB `bubble_position` is null
        // would be re-laid-out from scratch on every hydration, causing the
        // "blobs jump around on reload" bug.
        const updatedLocalPositions: Record<string, { ring: number; angle: number; x: number; y: number }> = forceRelayout ? {} : { ...state.localPositions };
        Object.values(finalBubbles).forEach((b) => {
          if (b.bubblePosition?.x != null && b.bubblePosition?.y != null) {
            updatedLocalPositions[b.id] = {
              ring: b.bubblePosition.ring,
              angle: b.bubblePosition.angle,
              x: b.bubblePosition.x,
              y: b.bubblePosition.y,
            };
          }
          // Lock life areas so subsequent ensureBubbleDefaults calls
          // (from upsertBubble / removeBubble) don't reposition them
          if (b.type === "life_area" && !b.metadata?.__locked) {
            (b as Bubble).metadata = { ...b.metadata, __locked: true };
          }
        });

        set({
          bubbles: finalBubbles,
          layoutVersion: LAYOUT_VERSION,
          localPositions: updatedLocalPositions,
        });
      },

      upsertBubble: (bubble) =>
        set((state) => {
          const next = {
            ...state.bubbles,
            [bubble.id]: {
              ...bubble,
              bubbleSize: bubble.bubbleSize ?? RING_CONFIG[bubble.type].baseSize,
              bubblePosition: bubble.bubblePosition ?? { ring: RING_CONFIG[bubble.type].radius, angle: 0 },
              metadata: { ...DEFAULT_METADATA[bubble.type], ...bubble.metadata },
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
      setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.25, Math.min(3.0, zoom)) }),

      updateBubblePosition: (id, position) =>
        set((state) => {
          const bubble = state.bubbles[id];
          if (!bubble) return { bubbles: state.bubbles };
          const norm = position.x != null && position.y != null ? { x: position.x, y: position.y } : polarToNormalized(position.ring, position.angle);
          const newPos = { ring: position.ring, angle: position.angle, x: norm.x, y: norm.y };
          return {
            bubbles: { ...state.bubbles, [id]: { ...bubble, bubblePosition: newPos, metadata: { ...bubble.metadata, __locked: true } } },
            localPositions: { ...state.localPositions, [id]: newPos },
          };
        }),

      getNextAngle: (type, options = {}) => {
        const state = get();
        const { lifeAreaId, parentId, anchorAngle, wedge } = options;
        const siblings = Object.values(state.bubbles).filter((c) => {
          if (c.type !== type) return false;
          if (type === "life_area") return true;
          if (type === "project" || type === "process") return c.lifeAreaId === lifeAreaId;
          if (type === "task") return (c.parentId ?? c.lifeAreaId ?? "u") === (parentId ?? lifeAreaId ?? "u");
          if (type === "idea") return parentId ? c.parentId === parentId : c.lifeAreaId === lifeAreaId;
          return true;
        });
        const angles = siblings.map((b) => b.bubblePosition?.angle).filter((a): a is number => typeof a === "number");
        const fallback = anchorAngle ?? (() => {
          if (type === "life_area") return -Math.PI / 2;
          if (type === "project" || type === "process") return state.bubbles[lifeAreaId ?? ""]?.bubblePosition?.angle ?? -Math.PI / 2;
          const p = parentId ? state.bubbles[parentId] : undefined;
          if (p?.bubblePosition) return p.bubblePosition.angle;
          return state.bubbles[lifeAreaId ?? ""]?.bubblePosition?.angle ?? -Math.PI / 2;
        })();
        const arc = wedge ?? (type === "life_area" ? TWO_PI : type === "project" || type === "process" ? Math.PI / 2 : Math.PI / 4);
        return computeNextAngle(angles, fallback, arc);
      },

      forgetLocalPosition: (id) => set((state) => { const p = { ...state.localPositions }; delete p[id]; return { localPositions: p }; }),

      syncUserContext: (userId) =>
        set((state) => {
          if (state.currentUserId === userId) return {};
          return { currentUserId: userId, bubbles: {}, localPositions: {}, pinnedBubbleId: null, zoomLevel: "day", selectedDate: new Date().toISOString().slice(0, 10), canvasZoom: 0.7, layoutVersion: 0 };
        }),

      reset: () =>
        set({ bubbles: {}, zoomLevel: "day", selectedDate: new Date().toISOString().slice(0, 10), pinnedBubbleId: null, localPositions: {}, currentUserId: null, canvasZoom: 0.7, layoutVersion: 0 }),
    }),
    {
      name: "life-scope-bubbles",
      partialize: (state) => ({
        bubbles: state.bubbles, zoomLevel: state.zoomLevel, selectedDate: state.selectedDate,
        pinnedBubbleId: state.pinnedBubbleId, localPositions: state.localPositions,
        currentUserId: state.currentUserId, canvasZoom: state.canvasZoom, layoutVersion: state.layoutVersion,
      }),
    },
  ),
);

// ─── Angle helpers ────────────────────────────────────────────
function normalizeAngle(a: number) { let r = a; while (r <= -Math.PI) r += TWO_PI; while (r > Math.PI) r -= TWO_PI; return r; }
function shortestAngleDiff(a: number, b: number) { return normalizeAngle(normalizeAngle(a) - normalizeAngle(b)); }

function computeNextAngle(angles: number[], anchor: number, wedge: number): number {
  if (angles.length === 0) return normalizeAngle(anchor);
  const sorted = angles.map(normalizeAngle).sort((a, b) => a - b);
  let best = normalizeAngle(anchor);
  let bestScore = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const nxt = i === sorted.length - 1 ? sorted[0]! + TWO_PI : sorted[i + 1]!;
    const gap = nxt - cur;
    if (gap <= 0.01) continue;
    const mid = normalizeAngle(cur + gap / 2);
    const dist = Math.abs(shortestAngleDiff(mid, anchor));
    if (wedge < TWO_PI && dist > wedge / 2) continue;
    const score = gap - dist * 0.1;
    if (score > bestScore) { bestScore = score; best = mid; }
  }
  return normalizeAngle(best);
}
