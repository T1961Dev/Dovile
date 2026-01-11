"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { classifyCaptureAction } from "@/actions/ai/classify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { Item } from "@/types/entities";
import { toast } from "sonner";

type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AvatarCoachProps = {
  userId: string;
  timezone: string;
  dailyCapacity: number;
  tasksScheduled: number;
};

export function AvatarCoach({
  userId,
  timezone,
  dailyCapacity,
  tasksScheduled,
}: AvatarCoachProps) {
  const open = useDashboardStore((state) => state.coachOpen);
  const setOpen = useDashboardStore((state) => state.setCoachOpen);
  const upsertItem = useDashboardStore((state) => state.upsertItem);
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your coach. Tell me what you want to do today.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!open) {
      setInput("");
    }
  }, [open]);

  const suggestions = useMemo(() => {
    if (tasksScheduled >= dailyCapacity) {
      return ["Let's defer something", "Maybe this weekend", "Next week"];
    }
    return ["Capture an idea", "Break down a project", "Schedule focus block"];
  }, [dailyCapacity, tasksScheduled]);

  const handleSubmit = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      const userMessage: CoachMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      try {
        const payload = await classifyCaptureAction({
            userId,
          text: content,
            timezone,
            dailyCapacity,
        });
        if (payload.createdItem) {
          upsertItem(payload.createdItem as Item);
        }
        const assistantMessage: CoachMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (payload.exceededCapacity) {
          toast.warning("You're at today's capacity. I suggested deferring it.");
        }
      } catch (error) {
        console.error(error);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I couldn't reach the coach right now. Try again in a moment.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [dailyCapacity, timezone, upsertItem, userId],
  );

  const handleToggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(permission);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };

    recorder.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: "audio/webm" });
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "input.webm");
        formData.append("timezone", timezone);
        const response = await fetch("/api/coach/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error("Transcription failed");
        }
        const { text } = await response.json();
        if (text) {
          void handleSubmit(text);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="coach-floating"
            onClick={() => setOpen(true)}
            className="fixed bottom-6 left-4 sm:bottom-8 sm:left-6 z-50 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#0EA8A8] text-xl sm:text-2xl text-white shadow-[0_16px_32px_-18px_rgba(14,168,168,0.5)] touch-manipulation active:scale-95"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(15,23,42,0.2)" }}
          >
            💫
          </motion.button>
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] sm:max-h-[85vh] w-[calc(100vw-1rem)] sm:w-[min(90vw,640px)] overflow-hidden rounded-2xl sm:rounded-3xl border border-[#0EA8A8]/25 bg-white p-0 text-[#0B1918] shadow-[0_35px_65px_-30px_rgba(14,168,168,0.45)]">
          <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
            <DialogHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl sm:rounded-2xl bg-[#D6FFF3]/40 p-3 sm:p-4">
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-base sm:text-lg font-semibold text-[#0B1918]">Coach</DialogTitle>
                <DialogDescription className="text-[10px] sm:text-xs text-[#195552]">
                  Type in or make a voice memo of any small idea or task you have and I'll place it directly into correct life area and it's project for you.
                </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
                className={`rounded-full border-[#0EA8A8]/30 bg-white px-3 sm:px-4 py-1 text-[10px] sm:text-xs font-medium text-[#0EA8A8] transition hover:border-[#0EA8A8]/60 active:bg-[#0EA8A8]/10 touch-manipulation ${
                  recording ? "bg-[#FF7348]/10 text-[#FF7348]" : ""
                }`}
              onClick={handleToggleRecording}
            >
              {recording ? "Stop" : "Voice"}
            </Button>
            </DialogHeader>
          </div>

          <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto border-t border-[#0EA8A8]/10 bg-[#F6FFFC] p-4 sm:p-6">
            <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl sm:rounded-3xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm leading-relaxed shadow-lg ${
                  message.role === "assistant"
                      ? "bg-white text-[#195552]"
                      : "ml-auto bg-[#0EA8A8] text-white"
                }`}
              >
                {message.content}
              </div>
            ))}
            </div>
          </div>

          <div className="border-t border-[#0EA8A8]/10 bg-white p-4 sm:p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit(input);
            }}
              className="flex items-center gap-2 sm:gap-3"
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Draft an idea…"
                className="h-10 sm:h-12 flex-1 rounded-full border border-[#0EA8A8]/20 bg-white text-xs sm:text-sm text-[#0B1918] placeholder:text-[#0EA8A8]/60 focus-visible:border-[#0EA8A8] focus-visible:ring-0"
            />
            <Button
              type="submit"
              disabled={loading}
                className="h-10 sm:h-12 rounded-full bg-[#FFD833] px-4 sm:px-6 text-xs sm:text-sm font-semibold text-[#0B1918] shadow-sm transition hover:bg-[#FFC300] active:bg-[#FFB800] touch-manipulation flex-shrink-0"
            >
              Send
            </Button>
          </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

