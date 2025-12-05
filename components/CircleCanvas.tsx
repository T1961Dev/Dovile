"use client";

import { useMemo, useRef } from "react";
import { motion, type PanInfo } from "framer-motion";

import clsx from "clsx";

import {
  RING_CONFIG,
  useBubbleStore,
  type BubbleType,
  type Bubble,
} from "@/store/bubbles";

const CANVAS_SIZE = 640;

export type DropTarget = "task" | "idea" | "project" | "life_area";
export type BubbleDropResult = {
  target: DropTarget;
  angle: number;
  distance: number;
};

type CircleCanvasProps = {
  onSelectBubble?: (id: string) => void;
  onBubbleDrop?: (bubble: Bubble, result: BubbleDropResult) => void;
};

const PALETTE = {
  ring: "var(--border)",
  crosshair: "var(--muted-foreground)",
  outline: "var(--primary)",
  hubFill: "var(--card)",
};

function determineDropTarget(distance: number): DropTarget {
  const boundaryTask =
    (RING_CONFIG.task.radius + RING_CONFIG.idea.radius) / 2;
  const boundaryIdea =
    (RING_CONFIG.idea.radius + RING_CONFIG.project.radius) / 2;
  const boundaryProject =
    (RING_CONFIG.project.radius + RING_CONFIG.life_area.radius) / 2;

  if (distance <= boundaryTask) return "task";
  if (distance <= boundaryIdea) return "idea";
  if (distance <= boundaryProject) return "project";
  return "life_area";
}

export function CircleCanvas({
  onSelectBubble,
  onBubbleDrop,
}: CircleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const bubbles = useBubbleStore((state) => state.bubbles);
  const pinnedBubbleId = useBubbleStore((state) => state.pinnedBubbleId);
  const setPinnedBubble = useBubbleStore((state) => state.setPinnedBubble);
  const updateBubblePosition = useBubbleStore((state) => state.updateBubblePosition);

  const layout = useMemo(() => {
    const bubbleArray = Object.values(bubbles);
    // Sort by size (smallest first) so smaller bubbles render last and appear on top
    return bubbleArray.sort((a, b) => {
      const sizeA = a.bubbleSize ?? RING_CONFIG[a.type].baseSize;
      const sizeB = b.bubbleSize ?? RING_CONFIG[b.type].baseSize;
      return sizeA - sizeB;
    });
  }, [bubbles]);
  
  // Handle canvas panning (drag empty space)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking on empty space (not on a bubble)
    const target = e.target as HTMLElement;
    const isBubble = target.closest('[data-bubble-id]');
    const isBackdrop = target.classList.contains("canvas-backdrop") || target === e.currentTarget;
    
    if (!isBubble && isBackdrop) {
      e.preventDefault();
      isPanningRef.current = true;
      canvasPanRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current || !containerRef.current) return;
    
    e.preventDefault();
    const deltaX = e.clientX - canvasPanRef.current.x;
    const deltaY = e.clientY - canvasPanRef.current.y;
    
    // Update pan position
    const container = containerRef.current;
    const currentTransform = container.style.transform || "translate(0px, 0px)";
    const match = currentTransform.match(/translate\(([^,]+)px,\s*([^)]+)\)px/);
    const currentX = match ? parseFloat(match[1]) || 0 : 0;
    const currentY = match ? parseFloat(match[2]) || 0 : 0;
    
    container.style.transform = `translate(${currentX + deltaX}px, ${currentY + deltaY}px)`;
    canvasPanRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasMouseUp = () => {
    isPanningRef.current = false;
  };

  const handleDragEnd = (bubble: Bubble, info: PanInfo) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const containerX = Math.min(Math.max(info.point.x - rect.left, 0), rect.width);
    const containerY = Math.min(Math.max(info.point.y - rect.top, 0), rect.height);
    const normalizedX = containerX / rect.width;
    const normalizedY = containerY / rect.height;

    const offsetX = containerX - rect.width / 2;
    const offsetY = containerY - rect.height / 2;

    const angle = Math.atan2(offsetY, offsetX);
    const ring = RING_CONFIG[bubble.type].radius;

    // Mark as manually positioned so it persists
    updateBubblePosition(bubble.id, { ring, angle, x: normalizedX, y: normalizedY });
    
    // Update metadata to mark as manually positioned
    const bubbleStore = useBubbleStore.getState();
    const currentBubble = bubbleStore.bubbles[bubble.id];
    if (currentBubble) {
      bubbleStore.upsertBubble({
        ...currentBubble,
        metadata: {
          ...currentBubble.metadata,
          __manualPosition: true,
          __locked: true,
        },
      });
    }

    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const target = determineDropTarget(distance);
    onBubbleDrop?.(bubble, { target, angle, distance });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-[640px] w-[640px] items-center justify-center overflow-visible bg-transparent"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      style={{ cursor: isPanningRef.current ? "grabbing" : "grab" }}
    >
      <Backdrop />
      <RadialGrid />

      {layout.map((bubble) => {
        const config = RING_CONFIG[bubble.type];
        const position = bubble.bubblePosition ?? {
          ring: config.radius,
          angle: 0,
        };
        const normalized =
          position.x != null && position.y != null
            ? { x: position.x, y: position.y }
            : {
                x: (Math.cos(position.angle) * position.ring + CANVAS_SIZE / 2) / CANVAS_SIZE,
                y: (Math.sin(position.angle) * position.ring + CANVAS_SIZE / 2) / CANVAS_SIZE,
              };
        const targetX = normalized.x * CANVAS_SIZE;
        const targetY = normalized.y * CANVAS_SIZE;

        const fillStyle = (() => {
          switch (bubble.type) {
            case "life_area": {
              const base =
                bubble.metadata?.color && typeof bubble.metadata.color === "string"
                  ? (bubble.metadata.color as string)
                  : "#0EA8A8";
              return base;
            }
            case "project":
              return "#28B7A3";
            case "process":
              return "#FF8F5A";
            case "task":
              return "#F4B13E";
            case "idea":
              return "#8F8CF5";
            default:
              return "#8F8CF5";
          }
        })();
        const size = config.baseSize;
        const isLifeArea = bubble.type === "life_area";
        const bubbleLabel = isLifeArea ? bubble.title : "";

        const isProjectOrProcess = bubble.type === "project" || bubble.type === "process";
        const isTaskOrIdea = bubble.type === "task" || bubble.type === "idea";

        // Calculate z-index based on size: smaller bubbles get higher z-index
        // This ensures smaller bubbles (tasks, ideas) are always on top of larger ones (life areas, projects)
        const bubbleSize = bubble.bubbleSize ?? size;
        const zIndex = Math.round(100 - bubbleSize); // Smaller bubbles get higher z-index

        return (
          <motion.div
            key={bubble.id}
            data-bubble-id={bubble.id}
            role="button"
            tabIndex={0}
            drag
            dragMomentum={false}
            onDragStart={(event) => {
              setPinnedBubble(bubble.id);
              const dragEvent = event as unknown as React.DragEvent;
              if (dragEvent.dataTransfer && bubble.type === "idea") {
                dragEvent.dataTransfer.setData("bubbleId", bubble.id);
                dragEvent.dataTransfer.effectAllowed = "move";
              }
            }}
            onDragEnd={(event, info) => handleDragEnd(bubble, info)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBubble?.(bubble.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setPinnedBubble(bubble.id);
                onSelectBubble?.(bubble.id);
              }
            }}
            className={clsx(
              "absolute flex items-center justify-center rounded-full transition focus:outline-none",
              isLifeArea
                ? "border-[3px] shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)]"
                : "shadow-[0_20px_40px_-28px_rgba(8,15,23,0.45)]",
              pinnedBubbleId === bubble.id ? "scale-110" : "hover:scale-[1.05]",
            )}
            style={{
              width: size,
              height: size,
              left: targetX - size / 2,
              top: targetY - size / 2,
              background: fillStyle,
              borderColor: isLifeArea ? "var(--primary)" : "transparent",
              zIndex,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: pinnedBubbleId === bubble.id ? 1.08 : 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            {isLifeArea ? (
              <div className="flex max-w-[90px] flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-[#0B1918]">
                  {bubbleLabel}
                </span>
                {typeof bubble.metadata?.rating === "number" ? (
                  <div className="mt-1.5 flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-semibold text-[#0B1918]">
                      {bubble.metadata.rating}/10
                    </span>
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-[#0B1918]/10">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(bubble.metadata.rating / 10) * 100}%`,
                          backgroundColor:
                            bubble.metadata.rating >= 8
                              ? "#0EA8A8"
                              : bubble.metadata.rating >= 6
                                ? "#28B7A3"
                                : bubble.metadata.rating >= 4
                                  ? "#F4B13E"
                                  : "#FF7348",
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : isProjectOrProcess ? (
              <span className="px-3 text-[8px] font-semibold uppercase tracking-[0.25em] text-white mix-blend-difference">
                {bubble.title}
              </span>
            ) : isTaskOrIdea ? (
              <span
                className={clsx(
                  "block h-[70%] w-[70%] rounded-full border-2",
                  bubble.type === "task"
                    ? "border-white/80 bg-white/60"
                    : "border-white/80 bg-transparent",
                )}
              />
            ) : null}
          </motion.div>
        );
      })}

      <CenterHub />
    </div>
  );
}

function Backdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 rounded-full border border-[var(--border)]" />
      <div className="pointer-events-none absolute inset-14 rounded-full border border-[var(--border)]/80" />
      <div className="pointer-events-none absolute inset-28 rounded-full border border-[var(--border)]/70" />
      <div className="pointer-events-none absolute inset-48 rounded-full border border-[var(--border)]/60" />
      <Crosshair />
    </>
  );
}

function Crosshair() {
  return (
    <>
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
        style={{
          background: `linear-gradient(to bottom, transparent, var(--muted-foreground), transparent)`,
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 left-0 h-px w-full -translate-y-1/2"
        style={{
          background: `linear-gradient(to right, transparent, var(--muted-foreground), transparent)`,
        }}
      />
    </>
  );
}

function RadialGrid() {
  const rings = [52, 86, 128, 180, 240];
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative h-[560px] w-[560px]">
        {rings.map((radius, index) => (
          <div
            key={radius}
            className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
            style={{
              width: radius * 2,
              height: radius * 2,
              transform: "translate(-50%, -50%)",
              opacity: 0.45 - index * 0.05,
              borderColor: "var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CenterHub() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_25px_45px_-30px_rgba(0,0,0,0.25)]"
      style={{
        border: "3px solid #0EA8A8",
      }}
    >
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.6em] text-[#0B1918]/65">You</p>
        <p className="mt-2 text-3xl font-semibold text-[#0B1918]">Today</p>
      </div>
    </div>
  );
}



