import { motion } from "framer-motion";

import type { XpSummary } from "@/types/entities";

type GamificationHUDProps = {
  summary: XpSummary;
};

export function GamificationHUD({ summary }: GamificationHUDProps) {
  return (
    <motion.div
      className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-lg"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col items-start min-w-[50px]">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Level</span>
        <motion.span
          key={summary.currentLevel}
          initial={{ scale: 0.85 }}
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="text-base font-semibold"
        >
          {summary.currentLevel}
        </motion.span>
      </div>
      <div className="flex flex-col min-w-[80px]">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">XP</span>
        <span className="font-semibold text-sm">
          {summary.totalXp}
          <span className="text-[10px] text-slate-400 ml-1">→ {summary.xpToNextLevel}</span>
        </span>
      </div>
      <div className="flex flex-col min-w-[60px]">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Streak</span>
        <span className="font-semibold text-sm">{summary.streak} 🔥</span>
      </div>
    </motion.div>
  );
}

