import { motion } from "framer-motion";

import type { XpSummary } from "@/types/entities";

type GamificationHUDProps = {
  summary: XpSummary;
};

export function GamificationHUD({ summary }: GamificationHUDProps) {
  return (
    <motion.div
      className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-[#0EA8A8]/20 bg-white/80 px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-[#0B1918] shadow-[0_18px_45px_-30px_rgba(14,168,168,0.45)] backdrop-blur-sm w-full sm:w-auto"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col items-start min-w-[40px] sm:min-w-[45px]">
        <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#0EA8A8]">Level</span>
        <motion.span
          key={summary.currentLevel}
          initial={{ scale: 0.85 }}
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="text-sm sm:text-base font-semibold text-[#0B1918]"
        >
          {summary.currentLevel}
        </motion.span>
      </div>
      <div className="flex flex-col min-w-[65px] sm:min-w-[75px]">
        <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#0EA8A8]">XP</span>
        <span className="font-semibold text-[10px] sm:text-xs text-[#0B1918]">
          {summary.totalXp} <span className="text-[8px] sm:text-[9px] text-[#195552] ml-0.5">/ {summary.totalXp + summary.xpToNextLevel}</span>
        </span>
        <span className="text-[7px] sm:text-[8px] text-[#195552] mt-0.5">{summary.xpToNextLevel} to next</span>
      </div>
      <div className="flex flex-col min-w-[48px] sm:min-w-[55px]">
        <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#0EA8A8]">Streak</span>
        <span className="font-semibold text-[10px] sm:text-xs text-[#0B1918]">{summary.streak} 🔥</span>
      </div>
    </motion.div>
  );
}

