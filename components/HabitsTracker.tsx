"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Habit = {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  color: string;
  active: boolean;
};

export type HabitCompletion = {
  habit_id: string;
  completed_at: string;
};

type HabitsTrackerProps = {
  habits: Habit[];
  completions: HabitCompletion[];
  today: string;
  onToggleCompletion: (habitId: string, date: string) => Promise<void>;
  onAddHabit?: (habit: Omit<Habit, "id">) => Promise<void>;
};

export function HabitsTracker({
  habits,
  completions,
  today,
  onToggleCompletion,
  onAddHabit,
}: HabitsTrackerProps) {
  const [pending, startTransition] = useTransition();
  const [newHabitTitle, setNewHabitTitle] = useState("");

  const activeHabits = habits.filter((h) => h.active);

  const isCompleted = (habitId: string, date: string) => {
    return completions.some(
      (c) => c.habit_id === habitId && c.completed_at === date,
    );
  };

  const handleToggle = (habitId: string) => {
    startTransition(async () => {
      await onToggleCompletion(habitId, today);
    });
  };

  const handleAddHabit = () => {
    if (!newHabitTitle.trim() || !onAddHabit) return;
    startTransition(async () => {
      await onAddHabit({
        title: newHabitTitle.trim(),
        color: "#0EA8A8",
        active: true,
      });
      setNewHabitTitle("");
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Today's Habits</h3>
        <span className="text-xs text-slate-500">{format(new Date(today), "MMM d")}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeHabits.map((habit) => {
          const completed = isCompleted(habit.id!, today);
          return (
            <button
              key={habit.id}
              onClick={() => handleToggle(habit.id!)}
              disabled={pending}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
                completed
                  ? "bg-[#0EA8A8] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {completed ? (
                <Check className="h-3 w-3" />
              ) : (
                <div className="h-3 w-3 rounded-full border-2 border-current" />
              )}
              <span>{habit.icon ? `${habit.icon} ` : ""}{habit.title}</span>
            </button>
          );
        })}

        {onAddHabit && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add habit..."
              value={newHabitTitle}
              onChange={(e) => setNewHabitTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddHabit();
                }
              }}
              className="h-8 w-32 rounded-full text-xs"
            />
            <Button
              size="sm"
              onClick={handleAddHabit}
              disabled={pending || !newHabitTitle.trim()}
              className="h-8 rounded-full"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

