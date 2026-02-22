"use client";

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export type HabitCompletion = {
  habit_id: string;
  completed_at: string;
};

type HabitsTrackerProps = {
  habits: Habit[];
  completions: HabitCompletion[];
  selectedDate: string;
  onToggle: (habitId: string, date: string) => void;
};

export function HabitsTracker({ habits, completions, selectedDate, onToggle }: HabitsTrackerProps) {
  if (!habits.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Habits</h4>
      <div className="flex flex-wrap gap-2">
        {habits.map((habit) => {
          const done = completions.some(
            (c) => c.habit_id === habit.id && c.completed_at === selectedDate,
          );
          return (
            <button
              key={habit.id}
              type="button"
              onClick={() => onToggle(habit.id, selectedDate)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
                done
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {done ? "✓ " : ""}{habit.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
