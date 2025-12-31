import { motion } from "framer-motion";

import type { XpSummary } from "@/types/entities";

type GamificationHUDProps = {
  summary: XpSummary;
};

export function GamificationHUD({ summary }: GamificationHUDProps) {
  return (
    <motion.div
      className="flex items-center gap-4 rounded-3xl border border-[#0EA8A8]/20 bg-white/80 px-5 py-3 text-sm text-[#0B1918] shadow-[0_18px_45px_-30px_rgba(14,168,168,0.45)] backdrop-blur-sm"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col items-start min-w-[55px]">
        <span className="text-[10px] uppercase tracking-[0.28em] text-[#0EA8A8]">Level</span>
        <motion.span
          key={summary.currentLevel}
          initial={{ scale: 0.85 }}
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="text-lg font-semibold text-[#0B1918]"
        >
          {summary.currentLevel}
        </motion.span>
      </div>
      <div className="flex flex-col min-w-[90px]">
        <span className="text-[10px] uppercase tracking-[0.28em] text-[#0EA8A8]">XP</span>
        <span className="font-semibold text-sm text-[#0B1918]">
          {summary.totalXp} <span className="text-[10px] text-[#195552] ml-1">/ {summary.totalXp + summary.xpToNextLevel}</span>
        </span>
        <span className="text-[9px] text-[#195552] mt-0.5">{summary.xpToNextLevel} to next level</span>
      </div>
      <div className="flex flex-col min-w-[65px]">
        <span className="text-[10px] uppercase tracking-[0.28em] text-[#0EA8A8]">Streak</span>
        <span className="font-semibold text-sm text-[#0B1918]">{summary.streak} 🔥</span>
      </div>
    </motion.div>
  );
}

