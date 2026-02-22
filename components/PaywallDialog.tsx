"use client";

import { useMemo, useState } from "react";

import { MAX_FREE_ITEMS, MAX_BASIC_ITEMS, STRIPE_PRICES } from "@/lib/constants";
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
    priceId: STRIPE_PRICES.basic,
    description: `Up to ${MAX_BASIC_ITEMS} items, Google Calendar sync, and streak tracking.`,
  },
  {
    name: "Pro",
    price: "$12/mo",
    priceId: STRIPE_PRICES.pro,
    description: "Unlimited items, AI coach expansions, priority support.",
  },
  {
    name: "Pro+",
    price: "$24/mo",
    priceId: STRIPE_PRICES.proplus,
    description: "Teams, shared areas, and advanced reporting snapshots.",
  },
];

type PaywallDialogProps = {
  totalItemCount: number;
};

export function PaywallDialog({ totalItemCount }: PaywallDialogProps) {
  const open = useDashboardStore((state) => state.paywallOpen);
  const setOpen = useDashboardStore((state) => state.setPaywallOpen);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const usageRatio = useMemo(() => {
    return Math.min(totalItemCount / MAX_FREE_ITEMS, 1);
  }, [totalItemCount]);

  const handleCheckout = async (priceId: string, planName: string) => {
    if (!priceId) {
      window.open("/settings", "_self");
      return;
    }
    setLoadingPlan(planName);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned", data);
      }
    } catch (err) {
      console.error("Checkout failed", err);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            You outgrew the free tier
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            You created {totalItemCount} items. Upgrade to keep adding circles and stay in flow.
            Promo codes can be applied at checkout.
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
                disabled={loadingPlan === plan.name}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                onClick={() => handleCheckout(plan.priceId, plan.name)}
              >
                {loadingPlan === plan.name ? "…" : plan.price}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-2">
          Already subscribed?{" "}
          <button
            className="underline hover:text-slate-600"
            onClick={() => {
              void fetch("/api/stripe/create-portal", { method: "POST" })
                .then((r) => r.json())
                .then((d) => { if (d.url) window.location.href = d.url; });
            }}
          >
            Manage subscription
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
