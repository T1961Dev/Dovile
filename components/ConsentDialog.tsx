"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConsentDialogProps = {
  open: boolean;
  onAccept: () => void;
};

export function ConsentDialog({ open, onAccept }: ConsentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted_terms_at: now,
          accepted_privacy_at: now,
        }),
      });
      onAccept();
    } catch (err) {
      console.error("Failed to save consent", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Welcome to LifeWheel</DialogTitle>
          <DialogDescription>
            Before you get started, please review and accept our terms.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            By using LifeWheel you agree to our{" "}
            <a href="/legal/terms" target="_blank" className="underline font-medium text-foreground">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/legal/privacy" target="_blank" className="underline font-medium text-foreground">
              Privacy Policy
            </a>
            . We store your data securely on EU servers via Supabase. You can export or delete your data at any time from Settings.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">
              I have read and agree to the Terms of Service and Privacy Policy.
            </span>
          </label>
        </div>
        <Button disabled={!checked || loading} onClick={handleAccept} className="w-full">
          {loading ? "Saving…" : "Continue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
