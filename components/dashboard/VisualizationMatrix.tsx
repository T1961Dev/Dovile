"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { format, addYears } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardStore } from "@/store/useDashboardStore";
import { createVisionAction } from "@/actions/visions";
import { decomposeVisionAction } from "@/actions/ai/decompose";
import { toast } from "sonner";

export function VisualizationMatrix() {
  const open = useDashboardStore((state) => state.visualizationMatrixOpen);
  const setOpen = useDashboardStore((state) => state.setVisualizationMatrixOpen);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeframe, setTimeframe] = useState("5");
  const [pending, startTransition] = useTransition();
  const [visionId, setVisionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Array<{ type: string; title: string; description?: string }>>([]);

  const handleCreateVision = () => {
    if (!title.trim()) {
      toast.error("Please enter a vision title");
      return;
    }

    startTransition(async () => {
      try {
        const vision = await createVisionAction({
          title,
          description: description || null,
          timeframe: `${timeframe} years`,
          target_date: addYears(new Date(), parseInt(timeframe)).toISOString().slice(0, 10),
        });
        setVisionId(vision.id);
        toast.success("Vision created! Now let's break it down into actionable steps.");
      } catch (error) {
        console.error(error);
        toast.error("Failed to create vision");
      }
    });
  };

  const handleDecompose = () => {
    if (!visionId) return;

    startTransition(async () => {
      try {
        const result = await decomposeVisionAction({
          visionId,
          description: description || title,
        });
        setSteps(result.steps.map(step => ({
          type: step.bubble_type,
          title: (step.bubble_payload as any)?.title || "Untitled",
          description: (step.bubble_payload as any)?.notes || undefined,
        })));
        toast.success("Vision decomposed! Review the steps below.");
      } catch (error) {
        console.error(error);
        toast.error("Failed to decompose vision");
      }
    });
  };

  const handleReset = () => {
    setTitle("");
    setDescription("");
    setTimeframe("5");
    setVisionId(null);
    setSteps([]);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-6 rounded-3xl border border-[#0EA8A8]/15 bg-[#FDFBF6] p-8 overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold text-[#0B1918]">
            Visualization Matrix
          </DialogTitle>
          <DialogDescription className="text-sm text-[#195552]">
            Paint yourself in X years. Set a manifestation goal, and the AI coach will help you break it down into actionable steps.
          </DialogDescription>
        </DialogHeader>

        {!visionId ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-[#0B1918] mb-2 block">
                Where do you see yourself in...
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-20 rounded-full border-[#0EA8A8]/20"
                />
                <span className="text-sm text-[#195552]">years?</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#0B1918] mb-2 block">
                Vision Title
              </label>
              <Input
                placeholder="e.g., Running my own business"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-full border-[#0EA8A8]/20"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#0B1918] mb-2 block">
                Description (optional)
              </label>
              <Textarea
                placeholder="Describe your vision in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] rounded-2xl border-[#0EA8A8]/20"
              />
            </div>

            <Button
              onClick={handleCreateVision}
              disabled={pending || !title.trim()}
              className="w-full rounded-full bg-[#0EA8A8] text-white hover:bg-[#0C8F90]"
            >
              {pending ? "Creating..." : "Create Vision"}
            </Button>
          </div>
        ) : steps.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#0EA8A8]/15 bg-white p-6">
              <h3 className="text-lg font-semibold text-[#0B1918] mb-2">{title}</h3>
              {description && (
                <p className="text-sm text-[#195552] mb-4">{description}</p>
              )}
              <p className="text-xs text-[#195552]/70">
                Timeframe: {timeframe} years
              </p>
            </div>

            <Button
              onClick={handleDecompose}
              disabled={pending}
              className="w-full rounded-full bg-[#28B7A3] text-white hover:bg-[#24A592]"
            >
              {pending ? "Decomposing..." : "Break Down into Actionable Steps"}
            </Button>

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full rounded-full border-[#0EA8A8]/30 text-[#0EA8A8] hover:bg-[#0EA8A8]/10"
            >
              Start Over
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#0EA8A8]/15 bg-white p-6">
              <h3 className="text-lg font-semibold text-[#0B1918] mb-2">{title}</h3>
              <p className="text-xs text-[#195552]/70 mb-4">
                AI has broken down your vision into {steps.length} actionable steps:
              </p>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="rounded-xl border border-[#0EA8A8]/15 bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0EA8A8] text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-[#0B1918] mb-1">
                        {step.title}
                      </h4>
                      {step.description && (
                        <p className="text-xs text-[#195552]">{step.description}</p>
                      )}
                      <span className="mt-2 inline-block rounded-full bg-[#D6FFF3]/70 px-2 py-0.5 text-[10px] font-medium text-[#0EA8A8]">
                        {step.type}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  toast.info("Use the Planner mode to approve and add these steps to your circle");
                  setOpen(false);
                }}
                className="flex-1 rounded-full bg-[#0EA8A8] text-white hover:bg-[#0C8F90]"
              >
                Add to Planner
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="rounded-full border-[#0EA8A8]/30 text-[#0EA8A8] hover:bg-[#0EA8A8]/10"
              >
                New Vision
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

