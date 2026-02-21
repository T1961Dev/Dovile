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
import { Separator } from "@/components/ui/separator";
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
    { id: "welcome", role: "assistant", content: "Hi! I'm your coach. Tell me what you want to do today." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => { if (!open) setInput(""); }, [open]);

  const handleSubmit = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);
      setInput("");
      setLoading(true);
      try {
        const payload = await classifyCaptureAction({ userId, text: content, timezone, dailyCapacity });
        if (payload.createdItem) upsertItem(payload.createdItem as Item);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: payload.reply }]);
        if (payload.exceededCapacity) toast.warning("At capacity. I suggested deferring.");
      } catch (error) {
        console.error(error);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Couldn't reach the coach. Try again." }]);
      } finally { setLoading(false); }
    },
    [dailyCapacity, timezone, upsertItem, userId],
  );

  const handleToggleRecording = async () => {
    if (recording) { mediaRecorderRef.current?.stop(); setRecording(false); return; }
    const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(permission);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: "audio/webm" });
      setLoading(true);
      let errorShown = false;
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "input.webm");
        formData.append("timezone", timezone);
        const response = await fetch("/api/coach/transcribe", { method: "POST", body: formData });
        if (!response.ok) {
          errorShown = true;
          const body = await response.json().catch(() => ({}));
          const msg = (body?.error as string) ?? "Transcription failed";
          toast.error(msg === "Transcription failed" ? "Voice input failed. Try again or type your message." : msg);
          return;
        }
        const { text } = await response.json();
        if (text) void handleSubmit(text);
      } catch (error) {
        if (!errorShown) {
          toast.error("Voice input failed. Try again or type your message.");
        }
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
            className="fixed bottom-6 left-4 sm:bottom-8 sm:left-6 z-50 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground shadow-md touch-manipulation active:scale-95"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
          >
            💫
          </motion.button>
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] sm:max-h-[85vh] w-[calc(100vw-1rem)] sm:w-[min(90vw,600px)] overflow-hidden rounded-xl border bg-card p-0 shadow-lg">
          <div className="p-5 pb-0">
            <DialogHeader className="rounded-lg bg-secondary/40 p-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <DialogTitle className="text-base font-bold">Coach</DialogTitle>
                  <DialogDescription className="text-xs">
                    Type or voice-record any idea or task and I&apos;ll place it in the right life area.
                  </DialogDescription>
                </div>
                <Button
                  variant={recording ? "destructive" : "outline"}
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={handleToggleRecording}
                >
                  {recording ? "Stop" : "Voice"}
                </Button>
              </div>
            </DialogHeader>
          </div>

          <Separator />

          <div className="flex-1 space-y-2.5 overflow-y-auto bg-muted/30 p-5 min-h-[200px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "bg-card text-foreground shadow-xs"
                    : "ml-auto bg-primary text-primary-foreground"
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>

          <Separator />

          <div className="p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); void handleSubmit(input); }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Draft an idea…"
                className="flex-1"
              />
              <Button type="submit" disabled={loading} size="sm" className="shrink-0">
                Send
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
