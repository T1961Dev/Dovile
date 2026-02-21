"use client";

import { useMemo, useRef, useCallback } from "react";
import { motion, type PanInfo } from "framer-motion";

import { RING_CONFIG, CANVAS_SIZE, useBubbleStore, type Bubble } from "@/store/bubbles";

export type DropTarget = "task" | "idea" | "project" | "life_area";
export type BubbleDropResult = { target: DropTarget; angle: number; distance: number };

type CircleCanvasProps = {
  onSelectBubble?: (id: string) => void;
  onBubbleDrop?: (bubble: Bubble, result: BubbleDropResult) => void;
};

function determineDropTarget(distance: number): DropTarget {
  const midLA = (RING_CONFIG.life_area.radius + RING_CONFIG.project.radius) / 2;
  const midPT = (RING_CONFIG.project.radius + RING_CONFIG.task.radius) / 2;
  const midTI = (RING_CONFIG.task.radius + RING_CONFIG.idea.radius) / 2;
  if (distance <= midLA) return "life_area";
  if (distance <= midPT) return "project";
  if (distance <= midTI) return "task";
  return "idea";
}

// ─── Color logic ──────────────────────────────────────────────
function bubbleFill(bubble: Bubble): string {
  switch (bubble.type) {
    case "life_area": return (typeof bubble.metadata?.color === "string" ? bubble.metadata.color : "#0EA8A8") as string;
    case "project": return "#0EA8A8";
    case "process": return "#7FE5D1";
    case "task":
      if (bubble.status === "done") return "#7FE5D1";
      if (bubble.status === "in_progress") return "#0EA8A8";
      return "#FF7348";
    case "idea": return "#DED6FF";
    default: return "#DED6FF";
  }
}

function textColor(bg: string): string {
  if (!bg.startsWith("#") || bg.length < 7) return "#fff";
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#1a1a1a" : "#ffffff";
}

// ─── Main component ──────────────────────────────────────────
export function CircleCanvas({ onSelectBubble, onBubbleDrop }: CircleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const bubbles = useBubbleStore((s) => s.bubbles);
  const pinnedId = useBubbleStore((s) => s.pinnedBubbleId);
  const zoom = useBubbleStore((s) => s.canvasZoom);
  const setZoom = useBubbleStore((s) => s.setCanvasZoom);
  const pin = useBubbleStore((s) => s.setPinnedBubble);
  const updatePos = useBubbleStore((s) => s.updateBubblePosition);

  // Sort: biggest behind, smallest on top
  const layout = useMemo(() =>
    Object.values(bubbles).sort((a, b) => (b.bubbleSize ?? 100) - (a.bubbleSize ?? 100)),
  [bubbles]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom(zoom * (e.deltaY > 0 ? 0.93 : 1.07));
  }, [zoom, setZoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY) };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      setZoom(zoom * (d / pinchRef.current.dist));
      pinchRef.current.dist = d;
    }
  }, [zoom, setZoom]);

  const handleDragEnd = useCallback((bubble: Bubble, info: PanInfo) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const actualW = rect.width / zoom;
    const actualH = rect.height / zoom;
    const cx = Math.min(Math.max((info.point.x - rect.left) / zoom, 0), actualW);
    const cy = Math.min(Math.max((info.point.y - rect.top) / zoom, 0), actualH);
    const nx = cx / actualW;
    const ny = cy / actualH;
    const ox = (nx - 0.5) * CANVAS_SIZE;
    const oy = (ny - 0.5) * CANVAS_SIZE;
    const angle = Math.atan2(oy, ox);
    const ring = RING_CONFIG[bubble.type].radius;
    updatePos(bubble.id, { ring, angle, x: nx, y: ny });
    const store = useBubbleStore.getState();
    const cur = store.bubbles[bubble.id];
    if (cur) store.upsertBubble({ ...cur, metadata: { ...cur.metadata, __manualPosition: true, __locked: true } });
    const dist = Math.sqrt(ox ** 2 + oy ** 2);
    onBubbleDrop?.(bubble, { target: determineDropTarget(dist), angle, distance: dist });
  }, [zoom, updatePos, onBubbleDrop]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-visible bg-transparent origin-center touch-manipulation shrink-0"
      style={{
        width: "min(85vw, calc(100vh - 220px), 900px)",
        height: "min(85vw, calc(100vh - 220px), 900px)",
        minWidth: "260px",
        minHeight: "260px",
        touchAction: "pan-x pan-y pinch-zoom",
        transform: `scale(${zoom})`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { pinchRef.current = null; }}
    >
      {/* Radial grid rings */}
      <RadialGrid />

      {/* Subtle crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 opacity-[0.06]" style={{ background: "var(--foreground)" }} />
      <div className="pointer-events-none absolute top-1/2 left-0 h-px w-full -translate-y-1/2 opacity-[0.06]" style={{ background: "var(--foreground)" }} />

      {/* All bubbles */}
      {layout.map((bubble) => {
        const config = RING_CONFIG[bubble.type];
        const pos = bubble.bubblePosition ?? { ring: config.radius, angle: 0 };
        const norm = pos.x != null && pos.y != null
          ? { x: pos.x, y: pos.y }
          : { x: (Math.cos(pos.angle) * pos.ring + CANVAS_SIZE / 2) / CANVAS_SIZE, y: (Math.sin(pos.angle) * pos.ring + CANVAS_SIZE / 2) / CANVAS_SIZE };

        const leftPct = norm.x * 100;
        const topPct = norm.y * 100;
        const logicalSize = bubble.bubbleSize ?? config.baseSize;
        const sizePct = (logicalSize / CANVAS_SIZE) * 100;

        const fill = bubbleFill(bubble);
        const txt = textColor(fill);
        const isLA = bubble.type === "life_area";
        const isPP = bubble.type === "project" || bubble.type === "process";
        const isTI = bubble.type === "task" || bubble.type === "idea";
        const zBase = isLA ? 10 : isPP ? 20 : bubble.type === "task" ? 30 : 40;
        const zIndex = pinnedId === bubble.id ? 100 : zBase;

        return (
          /* Outer wrapper: pure CSS positioning — Framer Motion cannot interfere */
          <div
            key={bubble.id}
            className="absolute"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${sizePct}%`,
              height: `${sizePct}%`,
              transform: "translate(-50%, -50%)",
              zIndex,
            }}
          >
            {/* Inner motion.div: drag + animations only */}
            <motion.div
              data-bubble-id={bubble.id}
              role="button"
              tabIndex={0}
              drag
              dragMomentum={false}
              onDragStart={() => pin(bubble.id)}
              onDragEnd={(_, info) => handleDragEnd(bubble, info)}
              onClick={(e) => { e.stopPropagation(); onSelectBubble?.(bubble.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pin(bubble.id); onSelectBubble?.(bubble.id); } }}
              className="w-full h-full rounded-full flex items-center justify-center cursor-pointer select-none focus:outline-none overflow-hidden"
              style={{
                background: fill,
                border: isLA ? "2px solid var(--primary)" : "none",
                boxShadow: pinnedId === bubble.id
                  ? "0 0 0 3px var(--primary), 0 4px 12px rgba(0,0,0,0.15)"
                  : isLA
                    ? "0 2px 10px rgba(0,0,0,0.12)"
                    : "0 1px 4px rgba(0,0,0,0.08)",
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Life Area: name + rating bar */}
              {isLA && (() => {
                const rating = typeof bubble.metadata?.rating === "number" ? (bubble.metadata.rating as number) : 5;
                const barColor = rating >= 7 ? "#22c55e" : rating >= 4 ? "#eab308" : "#ef4444";
                return (
                  <div className="flex flex-col items-center justify-center text-center px-1 overflow-hidden w-[85%]">
                    <span className="font-bold uppercase tracking-wider leading-tight line-clamp-2" style={{ color: txt, fontSize: `clamp(7px, ${logicalSize * 0.1}px, 14px)` }}>
                      {bubble.title}
                    </span>
                    <div className="mt-1 flex flex-col items-center gap-0.5 w-full">
                      <span className="font-semibold" style={{ color: txt, fontSize: `clamp(6px, ${logicalSize * 0.08}px, 11px)` }}>
                        {rating}/10
                      </span>
                      <div className="overflow-hidden rounded-full w-[70%]" style={{ height: 5, background: txt === "#ffffff" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${(rating / 10) * 100}%`, background: barColor }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Project/Process: name — only if bubble is big enough */}
              {isPP && logicalSize >= 28 && (
                <span className="font-semibold uppercase tracking-wide text-center leading-tight line-clamp-1 px-0.5 overflow-hidden" style={{ color: txt, fontSize: `clamp(5px, ${logicalSize * 0.18}px, 10px)`, maxWidth: "90%" }}>
                  {bubble.title}
                </span>
              )}
              {/* Task/Idea: no text — too small, just colored dot */}
            </motion.div>
          </div>
        );
      })}

      {/* Center hub */}
      <CenterHub />
    </div>
  );
}

// ─── Radial grid ─────────────────────────────────────────────
function RadialGrid() {
  const rings = [
    RING_CONFIG.life_area.radius,
    RING_CONFIG.project.radius,
    RING_CONFIG.task.radius,
    RING_CONFIG.idea.radius,
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {rings.map((r, i) => {
        const pct = (r / CANVAS_SIZE) * 200;
        return (
          <div
            key={r}
            className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
            style={{
              width: `${pct}%`,
              height: `${pct}%`,
              transform: "translate(-50%, -50%)",
              borderColor: "var(--border)",
              opacity: 0.2 - i * 0.03,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Center hub ──────────────────────────────────────────────
function CenterHub() {
  const hubPct = (140 / CANVAS_SIZE) * 100;
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center rounded-full bg-card border-2 border-primary shadow-md"
      style={{ width: `${hubPct}%`, height: `${hubPct}%`, minWidth: 60, minHeight: 60, transform: "translate(-50%, -50%)" }}
    >
      <div className="text-center">
        <p className="text-[8px] uppercase tracking-[0.35em] text-muted-foreground font-medium">You</p>
        <p className="mt-0.5 text-lg font-bold text-foreground">Today</p>
      </div>
    </div>
  );
}
