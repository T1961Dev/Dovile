"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card className="w-72 py-4">
        <CardContent className="space-y-1 px-4 py-0">
          <p className="text-sm font-bold">AI Coach</p>
          <p className="text-sm text-muted-foreground">No suggestions yet. Try adding a project or idea.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-72 py-4">
      <CardContent className="space-y-3 px-4 py-0">
        <p className="text-sm font-bold">Try these next</p>
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={suggestion.type === "task" ? "default" : "secondary"} className="capitalize text-[10px]">
                  {suggestion.type}
                </Badge>
                <Button size="sm" variant="secondary" className="h-6 text-xs" onClick={() => onApplySuggestion(suggestion.id)}>
                  Add
                </Button>
              </div>
              <p className="text-sm font-medium">{suggestion.title}</p>
              <p className="text-xs text-muted-foreground">{suggestion.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
