"use client";

import { motion } from "framer-motion";

import type { LifeArea } from "@/types/entities";

type AreaBubbleProps = {
  area: LifeArea;
  index: number;
  total: number;
  active?: boolean;
  onClick?: (areaId: string) => void;
};

function lightenColor(hex: string, amount = 0.15) {
  const sanitized = hex.replace("#", "");
  const num = parseInt(sanitized, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount * 255));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount * 255));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount * 255));
  return `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, 0.85)`;
}

function getEmojiByName(name: string): string {
  const map: Record<string, string> = {
    health: "💪",
    wellness: "🧘",
    career: "💼",
    work: "💼",
    business: "🏢",
    finance: "💰",
    money: "💰",
    home: "🏠",
    family: "👨‍👩‍👧‍👦",
    friends: "🤝",
    relationships: "❤️",
    love: "❤️",
    leisure: "🎨",
    fun: "🎉",
    growth: "📚",
    learning: "📚",
    spirituality: "🕯️",
  };
  const key = name.toLowerCase();
  return map[key] ?? "✨";
}

export function AreaBubble({ area, index, total, active, onClick }: AreaBubbleProps) {
  const angle = (index / total) * 2 * Math.PI;
  const radius = 300;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const emoji = getEmojiByName(area.name);

  return (
    <motion.button
      onClick={() => onClick?.(area.id)}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: active ? 1.12 : 1, opacity: 1 }}
      transition={{ duration: 0.35, delay: index * 0.02 }}
      className="absolute h-32 w-32 rounded-full shadow-[0_20px_45px_-28px_rgba(99,102,241,0.65)] ring-4 ring-white/40 transition hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      style={{
        left: "50%",
        top: "50%",
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
      }}
    >
      <span className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/50 bg-white/80 px-4 text-center text-xs font-semibold text-slate-800 backdrop-blur">
        <span
          className="mb-1 flex h-11 w-11 items-center justify-center rounded-full text-2xl"
          style={{
            background: lightenColor(area.color, 0.2),
          }}
        >
          {emoji}
        </span>
        <span className="text-sm font-semibold leading-tight text-slate-800">{area.name}</span>
        <span className="mt-1 text-[11px] font-medium text-indigo-500">{area.rating}/10</span>
      </span>
    </motion.button>
  );
}

