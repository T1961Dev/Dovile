import type { XpSummary } from "@/types/entities";

type GamificationHUDProps = {
  summary: XpSummary;
};

export function GamificationHUD({ summary }: GamificationHUDProps) {
  return (
    <div className="flex items-center gap-3 text-sm w-full">
      <div className="flex flex-col items-start">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Level</span>
        <span className="text-base font-bold">{summary.currentLevel}</span>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">XP</span>
        <span className="text-xs font-semibold">
          {summary.totalXp} <span className="text-muted-foreground">/ {summary.totalXp + summary.xpToNextLevel}</span>
        </span>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Streak</span>
        <span className="text-xs font-semibold">{summary.streak} days</span>
      </div>
    </div>
  );
}
