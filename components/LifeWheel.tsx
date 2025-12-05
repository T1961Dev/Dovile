// LifeWheel rebuilt to match reference radial layout
"use client";

import { useMemo, useState } from "react";

import type { CalendarEvent, Item, LifeArea, Workstream } from "@/types/entities";

type LifeWheelProps = {
  areas: LifeArea[];
  workstreams: Workstream[];
  todayTasks: Item[];
  ideas: Item[];
  events: CalendarEvent[];
  timezone: string;
  date: string;
  onOpenArea?: (areaId: string) => void;
};

type WheelCategory = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  items: number;
  angle: number;
};

const FALLBACK_CATEGORIES: WheelCategory[] = [
  { id: "health", name: "Health", emoji: "💪", color: "#0EA8A8", items: 0, angle: 0 },
  { id: "personal", name: "Personal Development", emoji: "📚", color: "#FFD833", items: 0, angle: 45 },
  { id: "home", name: "Home", emoji: "🏠", color: "#FFBC85", items: 0, angle: 90 },
  { id: "career", name: "Career", emoji: "💼", color: "#7FE5D1", items: 0, angle: 135 },
  { id: "love", name: "Love", emoji: "❤️", color: "#FF7348", items: 0, angle: 180 },
  { id: "family", name: "Family & Friends", emoji: "👨‍👩‍👧‍👦", color: "#FFF4DB", items: 0, angle: 225 },
  { id: "leisure", name: "Leisure", emoji: "🎨", color: "#DED6FF", items: 0, angle: 270 },
  { id: "finance", name: "Finance", emoji: "💰", color: "#195552", items: 0, angle: 315 },
];

export function LifeWheel({
  areas,
  workstreams,
  todayTasks,
  ideas,
  events,
  timezone,
  date,
  onOpenArea,
}: LifeWheelProps) {
  void workstreams;
  void events;
  void timezone;
  void date;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo<WheelCategory[]>(() => {
    if (!areas.length) {
      return FALLBACK_CATEGORIES;
    }
    const total = areas.length;
    return areas.map((area, index) => {
      const tasksCount = todayTasks.filter((task) => task.life_area_id === area.id).length;
      const ideasCount = ideas.filter((idea) => idea.life_area_id === area.id).length;

      return {
        id: area.id,
        name: area.name,
        emoji: getEmojiByName(area.name),
        color: area.color ?? "hsl(230, 60%, 92%)",
        items: tasksCount + ideasCount,
        angle: total ? (index / total) * 360 : 0,
      };
    });
  }, [areas, ideas, todayTasks]);

  const centerX = 400;
  const centerY = 400;
  const radius = 280;

  return (
    <div className="relative flex w-full items-center justify-center">
      <div className="relative h-[800px] w-[800px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 800">
          <defs>
            <linearGradient id="spokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(14,168,168,0)" />
              <stop offset="50%" stopColor="rgba(14,168,168,0.35)" />
              <stop offset="100%" stopColor="rgba(14,168,168,0)" />
            </linearGradient>
          </defs>

          <circle cx={centerX} cy={centerY} r={330} fill="#FDFBF6" />
          <circle cx={centerX} cy={centerY} r={radius + 40} fill="none" stroke="#D6FFF3" strokeWidth="1.5" />
          <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#BFF6EB" strokeWidth="1.2" />
          <circle cx={centerX} cy={centerY} r={radius - 80} fill="none" stroke="#9EE8DD" strokeWidth="1" />
          <circle cx={centerX} cy={centerY} r={radius - 150} fill="none" stroke="#7FE5D1" strokeWidth="0.8" />

          {categories.map((category) => {
            const pos = getPosition(category.angle, radius);
            return (
              <line
                key={`line-${category.id}`}
                x1={centerX}
                y1={centerY}
                x2={pos.x}
                y2={pos.y}
                stroke="url(#spokeGradient)"
                strokeWidth="1.2"
              />
            );
          })}
        </svg>

        {categories.map((category) => {
          const pos = getPosition(category.angle, radius);
          const isSelected = selectedCategory === category.id;
          const badgeColor = softenToBrand(category.color);

          return (
            <button
              key={category.id}
              className={`absolute flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 transform flex-col items-center justify-center rounded-full border border-[#0EA8A8]/25 bg-white/90 shadow-[0_16px_36px_-26px_rgba(14,168,168,0.18)] transition-all duration-300 hover:scale-110 ${
                isSelected ? "scale-110 shadow-[0_20px_44px_-22px_rgba(14,168,168,0.25)]" : ""
              }`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              onClick={() => {
                setSelectedCategory(category.id);
                onOpenArea?.(category.id);
              }}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-full text-2xl"
                style={{
                  background: badgeColor.background,
                  border: `1px solid ${badgeColor.border}`,
                  color: badgeColor.foreground,
                }}
              >
                {category.emoji}
              </div>
              <div className="px-4 text-center text-sm font-semibold text-[#0B1918]">{category.name}</div>
              <div className="mt-1 text-xs text-[#195552]">{category.items} items</div>
            </button>
          );
        })}

        <div className="absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#0EA8A8]/20 bg-white text-[#0B1918] shadow-[0_30px_60px_-30px_rgba(14,168,168,0.25)]">
          <div className="text-2xl font-bold leading-none">Life</div>
          <div className="text-2xl font-bold leading-none">Scope</div>
        </div>
      </div>
    </div>
  );
}

function getPosition(angle: number, distance: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: 400 + distance * Math.cos(rad),
    y: 400 + distance * Math.sin(rad),
  };
}

function softenToBrand(color: string) {
  const base = parseHex(color);
  const warm = { r: 255, g: 244, b: 219 }; // cream blend

  if (!base) {
    return {
      background: "rgba(255, 244, 219, 0.7)",
      border: "#FFD833",
      foreground: "#0B1918",
    };
  }

  const mixFactor = 0.45;
  const mixed = {
    r: Math.round(base.r * (1 - mixFactor) + warm.r * mixFactor),
    g: Math.round(base.g * (1 - mixFactor) + warm.g * mixFactor),
    b: Math.round(base.b * (1 - mixFactor) + warm.b * mixFactor),
  };

  return {
    background: `rgba(${mixed.r}, ${mixed.g}, ${mixed.b}, 0.65)`,
    border: rgbToHex(base),
    foreground: base.r + base.g + base.b > 450 ? "#0B1918" : "#FFFFFF",
  };
}

function parseHex(value: string) {
  if (!value || !value.startsWith("#") || (value.length !== 7 && value.length !== 4)) {
    return null;
  }

  const hex =
    value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;

  const num = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((component) => {
      const clamped = Math.max(0, Math.min(255, component));
      return clamped.toString(16).padStart(2, "0");
    })
    .join("")}`;
}

function getEmojiByName(name: string) {
  const key = name.toLowerCase();
  const map: Record<string, string> = {
    health: "💪",
    wellness: "🧘",
    personal: "📚",
    "personal development": "📚",
    home: "🏠",
    career: "💼",
    work: "💼",
    love: "❤️",
    relationships: "❤️",
    family: "👨‍👩‍👧‍👦",
    friends: "🤝",
    leisure: "🎨",
    fun: "🎉",
    finance: "💰",
    money: "💰",
    spirituality: "🕯️",
  };
  return map[key] ?? "✨";
}


