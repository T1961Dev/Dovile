"use client";

import { useMemo } from "react";

import { MAX_FREE_ITEMS } from "@/lib/constants";
import { useDashboardStore } from "@/store/useDashboardStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Basic",
    price: "$6/mo",
    description: "Unlock 500 items, Google Calendar sync, and streak tracking.",
  },
  {
    name: "Pro",
    price: "$12/mo",
    description: "Unlimited items, AI coach expansions, priority support.",
  },
  {
    name: "Pro+",
    price: "$24/mo",
    description: "Teams, shared areas, and advanced reporting snapshots.",
  },
];

type PaywallDialogProps = {
  totalItemCount: number;
};

export function PaywallDialog({ totalItemCount }: PaywallDialogProps) {
  const open = useDashboardStore((state) => state.paywallOpen);
  const setOpen = useDashboardStore((state) => state.setPaywallOpen);

  const usageRatio = useMemo(() => {
    return Math.min(totalItemCount / MAX_FREE_ITEMS, 1);
  }, [totalItemCount]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            You outgrew the free tier
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            You created {totalItemCount} items. Upgrade to keep adding circles and stay in flow.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-600">
            <span>Usage</span>
            <span>
              {totalItemCount}/{MAX_FREE_ITEMS}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-900" style={{ width: `${usageRatio * 100}%` }} />
          </div>
        </div>
        <div className="grid gap-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                <p className="text-xs text-slate-500">{plan.description}</p>
              </div>
              <Button
                variant="default"
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                onClick={() => {
                  void fetch("/api/stripe/create-portal", { method: "POST" })
                    .then((response) => response.json())
                    .then((data) => {
                      if (data.url) {
                        window.location.href = data.url;
                      }
                    });
                }}
              >
                {plan.price}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

