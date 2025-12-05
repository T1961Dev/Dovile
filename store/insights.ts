"use client";

import { create } from "zustand";

export type SuggestionType = "task" | "idea";

export type BubbleSuggestion = {
  id: string;
  bubbleId: string;
  title: string;
  description: string;
  type: SuggestionType;
};

interface InsightState {
  suggestions: BubbleSuggestion[];
  setSuggestionsForBubble: (bubbleId: string, suggestions: BubbleSuggestion[]) => void;
  removeSuggestion: (id: string) => void;
  clearForBubble: (bubbleId: string) => void;
}

export const useInsightStore = create<InsightState>((set) => ({
  suggestions: [],
  setSuggestionsForBubble: (bubbleId, suggestions) =>
    set((state) => ({
      suggestions: [
        ...state.suggestions.filter((suggestion) => suggestion.bubbleId !== bubbleId),
        ...suggestions,
      ],
    })),
  removeSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((suggestion) => suggestion.id !== id),
    })),
  clearForBubble: (bubbleId) =>
    set((state) => ({
      suggestions: state.suggestions.filter((suggestion) => suggestion.bubbleId !== bubbleId),
    })),
}));


