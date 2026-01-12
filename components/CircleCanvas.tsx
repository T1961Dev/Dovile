"use client";

import { useMemo, useRef, useEffect, useState } from "react";
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
  // Updated boundaries based on new layout:
  // life_area: 260, project: 285, task: 320, idea: 360
  const boundaryProject = (RING_CONFIG.life_area.radius + RING_CONFIG.project.radius) / 2; // ~272
  const boundaryTask = (RING_CONFIG.project.radius + RING_CONFIG.task.radius) / 2; // ~302
  const boundaryIdea = (RING_CONFIG.task.radius + RING_CONFIG.idea.radius) / 2; // ~340

  if (distance <= RING_CONFIG.life_area.radius) return "life_area";
  if (distance <= boundaryProject) return "life_area"; // Near life area edge
  if (distance <= boundaryTask) return "project"; // Near project/process
  if (distance <= boundaryIdea) return "task"; // Task area
  return "idea"; // Idea area (most outer)
}

export function CircleCanvas({
  onSelectBubble,
  onBubbleDrop,
}: CircleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchZoomRef = useRef<{ distance: number; centerX: number; centerY: number } | null>(null);
  const [containerSize, setContainerSize] = useState(CANVAS_SIZE);
  const bubbles = useBubbleStore((state) => state.bubbles);
  const pinnedBubbleId = useBubbleStore((state) => state.pinnedBubbleId);
  const canvasZoom = useBubbleStore((state) => state.canvasZoom);
  const setCanvasZoom = useBubbleStore((state) => state.setCanvasZoom);
  const setPinnedBubble = useBubbleStore((state) => state.setPinnedBubble);
  const updateBubblePosition = useBubbleStore((state) => state.updateBubblePosition);

  // Measure actual container size for responsive positioning
  // Use offsetWidth/offsetHeight to get size BEFORE transform scale is applied
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        // Use offsetWidth/offsetHeight to get logical size (before transform scale)
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        const size = Math.min(width, height);
        if (size > 0) {
          setContainerSize(size);
        }
      }
    };
    
    // Use ResizeObserver for more accurate size tracking
    if (containerRef.current) {
      // Initial measurement
      updateSize();
      
      // Also use ResizeObserver for window resize/zoom changes
      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(containerRef.current);
      
      // Also listen to window resize as backup
      window.addEventListener('resize', updateSize);
      
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
  }, []);

  const layout = useMemo(() => {
    const bubbleArray = Object.values(bubbles);
    // Sort by size (smallest first) so smaller bubbles render last and appear on top
    return bubbleArray.sort((a, b) => {
      const sizeA = a.bubbleSize ?? RING_CONFIG[a.type].baseSize;
      const sizeB = b.bubbleSize ?? RING_CONFIG[b.type].baseSize;
      return sizeA - sizeB;
    });
  }, [bubbles]);
  
  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(3.0, canvasZoom * delta));
    setCanvasZoom(newZoom);
  };

  // Handle pinch zoom (touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      pinchZoomRef.current = { distance, centerX, centerY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchZoomRef.current && containerRef.current) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scale = distance / pinchZoomRef.current.distance;
      const newZoom = Math.max(0.25, Math.min(3.0, canvasZoom * scale));
      setCanvasZoom(newZoom);
      pinchZoomRef.current.distance = distance;
    }
  };

  const handleTouchEnd = () => {
    pinchZoomRef.current = null;
  };

  const handleDragEnd = (bubble: Bubble, info: PanInfo) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const containerX = Math.min(Math.max(info.point.x - rect.left, 0), rect.width);
    const containerY = Math.min(Math.max(info.point.y - rect.top, 0), rect.height);
    // Use CANVAS_SIZE for normalization since coordinates are stored relative to 640px
    const normalizedX = containerX / CANVAS_SIZE;
    const normalizedY = containerY / CANVAS_SIZE;

    // For angle/distance calculation, use actual container size
    const actualSize = Math.min(rect.width, rect.height, CANVAS_SIZE);
    const offsetX = containerX - actualSize / 2;
    const offsetY = containerY - actualSize / 2;

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
      className="relative flex items-center justify-center overflow-visible bg-transparent origin-center touch-manipulation aspect-square"
      style={{ 
        width: 'min(95vw, 640px)',
        height: 'min(85vh, 640px)',
        minWidth: '280px',
        minHeight: '280px',
        touchAction: "pan-x pan-y pinch-zoom",
        transform: `scale(${canvasZoom})`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleWheel(e);
      }}
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          handleTouchStart(e);
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          handleTouchMove(e);
        }
      }}
      onTouchEnd={handleTouchEnd}
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
        // Normalized coordinates are always based on CANVAS_SIZE (0-1 range)
        // Multiply by actual container size to get pixel position in the rendered canvas
        const targetX = normalized.x * containerSize;
        const targetY = normalized.y * containerSize;

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
            case "task": {
              // Task status colors: Softer, more professional palette
              if (bubble.status === "done") return "#28B7A3"; // mint green for done
              if (bubble.status === "in_progress") return "#5B9BD5"; // soft blue for in progress
              // pending/default - soft purple
              return "#9B8CF5"; // soft purple for pending tasks
            }
            case "idea":
              return "#B8C5D0"; // soft blue-grey for ideas
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
              // Make task/idea bubbles slightly larger to accommodate text
              isTaskOrIdea ? "min-w-[70px] min-h-[70px]" : "",
            )}
            style={{
              width: isTaskOrIdea ? Math.max(size, 70) : size,
              height: isTaskOrIdea ? Math.max(size, 70) : size,
              left: targetX - (isTaskOrIdea ? Math.max(size, 70) : size) / 2,
              top: targetY - (isTaskOrIdea ? Math.max(size, 70) : size) / 2,
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
              <div className="flex h-full w-full flex-col items-center justify-center px-1.5">
                <span className="text-[8px] font-semibold text-white text-center leading-tight px-1 line-clamp-2 mix-blend-difference">
                  {bubble.title.split(' ').slice(0, 4).join(' ')}
                </span>
              </div>
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
  // Match the actual ring positions from RING_CONFIG
  // life_area: 260, project: 285, task: 320, idea: 360
  const rings = [
    RING_CONFIG.life_area.radius,  // 260
    RING_CONFIG.project.radius,    // 285
    RING_CONFIG.task.radius,       // 320
    RING_CONFIG.idea.radius,       // 360
  ];
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative w-full h-full" style={{ aspectRatio: '1' }}>
        {rings.map((radius, index) => {
          // Convert radius to percentage of CANVAS_SIZE, which will scale with container
          const radiusPercent = (radius / CANVAS_SIZE) * 100;
          return (
            <div
              key={radius}
              className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
              style={{
                width: `${radiusPercent * 2}%`,
                height: `${radiusPercent * 2}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0.35 - index * 0.06,
                borderColor: "var(--border)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function CenterHub() {
  // Center hub is 176px on 640px canvas = 27.5% of canvas
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_25px_45px_-30px_rgba(0,0,0,0.25)]"
      style={{
        width: '27.5%',
        height: '27.5%',
        minWidth: '77px',
        minHeight: '77px',
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



