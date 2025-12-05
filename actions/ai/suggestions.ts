"use server";

import { unstable_noStore as noStore } from "next/cache";
import { randomUUID } from "crypto";

import type { BubbleSuggestion, SuggestionType } from "@/store/insights";

type FetchSuggestionsInput = {
  bubbleId: string;
  bubbleType: string;
  bubbleTitle: string;
};

const suggestionTemplates: Record<string, { title: string; description: string; type: SuggestionType }[]> = {
  life_area: [
    {
      title: "Reflect on weekly progress",
      description: "Journal how you feel about this life area to track the rating over time.",
      type: "idea",
    },
    {
      title: "Schedule a focus block",
      description: "Dedicate 45 minutes this week to a meaningful activity in this area.",
      type: "task",
    },
  ],
  project: [
    {
      title: "Define the next milestone",
      description: "Clarify what success looks like for the upcoming phase.",
      type: "idea",
    },
    {
      title: "Break down deliverables",
      description: "List two actionable tasks that move this project forward.",
      type: "task",
    },
  ],
  process: [
    {
      title: "Review recurrence setup",
      description: "Confirm this process frequency still matches your capacity.",
      type: "idea",
    },
    {
      title: "Automate one step",
      description: "Identify a small improvement or template to speed up this workflow.",
      type: "task",
    },
  ],
  task: [
    {
      title: "Add a note",
      description: "Clarify what 'done' means so it’s easy to complete later.",
      type: "idea",
    },
    {
      title: "Schedule it",
      description: "Pick a day and time to execute this task.",
      type: "task",
    },
  ],
  idea: [
    {
      title: "Sort into scope",
      description: "Decide whether this idea belongs in today, this week, or later.",
      type: "task",
    },
    {
      title: "Add context",
      description: "Write a quick note so future you remembers why it mattered.",
      type: "idea",
    },
  ],
  vision: [
    {
      title: "Imagine the outcome",
      description: "Write a short description of how life feels when this vision is true.",
      type: "idea",
    },
    {
      title: "Pick a keystone habit",
      description: "Choose one recurring action that supports this vision.",
      type: "task",
    },
  ],
};

export async function fetchSuggestionsAction({
  bubbleId,
  bubbleType,
  bubbleTitle,
}: FetchSuggestionsInput): Promise<BubbleSuggestion[]> {
  noStore();

  const templates =
    suggestionTemplates[bubbleType] ?? suggestionTemplates["idea"];

  return templates.slice(0, 2).map((template) => ({
    id: randomUUID(),
    bubbleId,
    title: template.title.replace("this", bubbleTitle.toLowerCase()),
    description: template.description,
    type: template.type,
  }));
}


