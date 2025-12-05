"use client";

import { memo } from "react";

type Suggestion = {
  id: string;
  title: string;
  description: string;
  type: "task" | "idea";
};

type AIInsightPanelProps = {
  suggestions: Suggestion[];
  onApplySuggestion: (id: string) => void;
};

export const AIInsightPanel = memo(function AIInsightPanel({
  suggestions,
  onApplySuggestion,
}: AIInsightPanelProps) {
  if (suggestions.length === 0) {
    return (
      <div className="flex w-72 flex-col gap-3 rounded-3xl border border-[#0EA8A8]/20 bg-white/80 p-4 text-sm text-[#195552] shadow">
        <p className="font-semibold text-[#0B1918]">AI Coach</p>
        <p>No suggestions yet. Try adding a project or idea.</p>
      </div>
    );
  }

  return (
    <div className="flex w-72 flex-col gap-3 rounded-3xl border border-[#0EA8A8]/20 bg-white p-4 text-sm text-[#195552] shadow-[0_18px_36px_-28px_rgba(14,168,168,0.3)]">
      <p className="font-semibold text-[#0B1918]">Try these next</p>
      <ul className="space-y-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="rounded-2xl border border-[#0EA8A8]/15 bg-[#FDFBF6] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-[#0EA8A8]">
                {suggestion.type === "task" ? "Task" : "Idea"}
              </span>
              <button
                onClick={() => onApplySuggestion(suggestion.id)}
                className="rounded-full bg-[#FFD833] px-3 py-1 text-xs font-semibold text-[#0B1918] transition hover:bg-[#FECB32]"
              >
                Add
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0B1918]">{suggestion.title}</p>
            <p className="text-xs text-[#195552]">{suggestion.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
});


