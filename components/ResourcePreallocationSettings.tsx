"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResourceBlock } from "@/lib/resource-capacity";

type ResourcePreallocationSettingsProps = {
  initialBlocks: ResourceBlock[];
  onSave: (blocks: ResourceBlock[]) => Promise<void>;
};

export function ResourcePreallocationSettings({
  initialBlocks,
  onSave,
}: ResourcePreallocationSettingsProps) {
  const [blocks, setBlocks] = useState<ResourceBlock[]>(initialBlocks);
  const [pending, startTransition] = useTransition();

  const handleAddBlock = () => {
    setBlocks([
      ...blocks,
      {
        name: "New Block",
        start_hour: 0,
        duration_hours: 1,
        color: "#6b7280",
        active: true,
      },
    ]);
  };

  const handleUpdateBlock = (index: number, updates: Partial<ResourceBlock>) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index]!, ...updates };
    setBlocks(updated);
  };

  const handleRemoveBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    startTransition(async () => {
      await onSave(blocks);
    });
  };

  return (
    <Card className="rounded-3xl border border-slate-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Resource Preallocation</CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Define your routine time blocks (sleep, food, exercise, etc.). These will be subtracted
          from your available time for tasks.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <Input
                placeholder="Name (e.g., Sleep)"
                value={block.name}
                onChange={(e) => handleUpdateBlock(index, { name: e.target.value })}
                className="flex-1 rounded-full"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Start:</label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={block.start_hour}
                  onChange={(e) =>
                    handleUpdateBlock(index, { start_hour: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-16 rounded-full text-center"
                />
                <span className="text-xs text-slate-500">h</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Duration:</label>
                <Input
                  type="number"
                  min={0.25}
                  max={24}
                  step={0.25}
                  value={block.duration_hours}
                  onChange={(e) =>
                    handleUpdateBlock(index, {
                      duration_hours: parseFloat(e.target.value) || 1,
                    })
                  }
                  className="w-20 rounded-full text-center"
                />
                <span className="text-xs text-slate-500">h</span>
              </div>
              <Input
                type="color"
                value={block.color}
                onChange={(e) => handleUpdateBlock(index, { color: e.target.value })}
                className="w-12 h-10 rounded-full cursor-pointer"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveBlock(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={handleAddBlock}
          className="w-full rounded-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Time Block
        </Button>

        <Button
          className="w-full rounded-full bg-slate-900 text-white hover:bg-slate-800"
          onClick={handleSave}
          disabled={pending}
        >
          {pending ? "Saving..." : "Save Resource Blocks"}
        </Button>

        <div className="rounded-2xl bg-blue-50 p-3 text-xs text-blue-800">
          <p className="font-semibold mb-1">💡 How it works:</p>
          <p>
            Available time = 24 hours - GCal events - Resource blocks. The AI coach will only
            suggest tasks that fit in your available time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

