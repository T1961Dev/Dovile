"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ResourcePreallocationSettings } from "@/components/ResourcePreallocationSettings";
import {
  DEFAULT_DAILY_CAPACITY,
  MAX_FREE_ITEMS,
  MAX_BASIC_ITEMS,
  STRIPE_PRICES,
  MAX_FREE_DAILY_CAPACITY,
  MAX_BASIC_DAILY_CAPACITY,
  MAX_PRO_DAILY_CAPACITY,
} from "@/lib/constants";
import type { Database } from "@/types/database";
import type { ResourceBlock } from "@/lib/resource-capacity";

import {
  ArrowLeft,
  User as UserIcon,
  CreditCard,
  Calendar,
  Bot,
  Shield,
  Crown,
  ExternalLink,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
type BillingRow = Database["public"]["Tables"]["billing_profiles"]["Row"];
type CoachConfigRow = Database["public"]["Tables"]["coach_configs"]["Row"];

const TIMEZONES = [
  "Pacific/Midway",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Halifax",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Caracas",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Vienna",
  "Europe/Prague",
  "Europe/Warsaw",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Helsinki",
  "Europe/Vilnius",
  "Europe/Riga",
  "Europe/Tallinn",
  "Europe/Bucharest",
  "Europe/Sofia",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Kiev",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Casablanca",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Manila",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Pacific/Auckland",
  "Pacific/Fiji",
];

type SettingsClientProps = {
  user: User;
  settings: SettingsRow | null;
  billingProfile: BillingRow | null;
  calendarConnected: boolean;
  coachConfig: CoachConfigRow | null;
  totalItemCount: number;
};

export function SettingsClient({
  user,
  settings,
  billingProfile,
  calendarConnected,
  coachConfig,
  totalItemCount,
}: SettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "account";

  const [timezone, setTimezone] = useState(settings?.timezone ?? "Europe/London");
  const [capacity, setCapacity] = useState(settings?.daily_capacity ?? DEFAULT_DAILY_CAPACITY);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [provider, setProvider] = useState(coachConfig?.provider ?? "openai");
  const [model, setModel] = useState(coachConfig?.model ?? "gpt-4o-mini");
  const [calendarEnabled, setCalendarEnabled] = useState(calendarConnected);
  const [resourceBlocks, setResourceBlocks] = useState<ResourceBlock[]>([]);
  const [pending, startTransition] = useTransition();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialCapacity = settings?.daily_capacity ?? DEFAULT_DAILY_CAPACITY;

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [portalLoading, setPortalLoading] = useState(false);

  const billingStatus = billingProfile?.subscription_status ?? "free";
  const priceId = billingProfile?.price_id ?? null;
  const planLabel = billingStatus === "active"
    ? priceId === STRIPE_PRICES.proplus
      ? "Pro+"
      : priceId === STRIPE_PRICES.pro
        ? "Pro"
        : priceId === STRIPE_PRICES.basic
          ? "Basic"
          : "Active"
    : "Free";

  const maxCapacity = billingStatus === "free" || !billingStatus
    ? MAX_FREE_DAILY_CAPACITY
    : priceId === STRIPE_PRICES.basic
      ? MAX_BASIC_DAILY_CAPACITY
      : MAX_PRO_DAILY_CAPACITY;

  useEffect(() => {
    fetch("/api/resource-blocks", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.blocks) setResourceBlocks(data.blocks);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      toast.success("Subscription activated! Thank you.");
    }
    if (searchParams.get("calendar") === "connected") {
      toast.success("Google Calendar connected successfully.");
    }
    if (searchParams.get("calendar") === "error") {
      toast.error("Failed to connect Google Calendar. Please try again.");
    }
  }, [searchParams]);

  const saveSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          daily_capacity: capacity,
          calendar_provider: calendarEnabled ? "google" : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Failed to save settings");
        return false;
      }
      toast.success("Settings saved");
      return true;
    } catch {
      toast.error("Failed to save settings");
      return false;
    }
  }, [timezone, capacity, calendarEnabled]);

  useEffect(() => {
    if (capacity === initialCapacity) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveSettings();
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [capacity, initialCapacity, saveSettings]);

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const response = await fetch("/api/calendar/connect");
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setConnectingCalendar(false);
    }
  };

  const handleExport = async (format: "json" | "csv" | "excel" = "json") => {
    const urls: Record<string, string> = {
      json: "/api/gdpr/export",
      csv: "/api/export/csv",
      excel: "/api/export/excel",
    };
    const extensions: Record<string, string> = { json: ".json", csv: ".csv", excel: ".xlsx" };
    const response = await fetch(urls[format]);
    if (!response.ok) { toast.error("Export failed"); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lifewheel-export${extensions[format]}`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${format.toUpperCase()} exported`);
  };

  const handleImportCsv = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import/csv", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Import failed");
      } else {
        setImportResult(data);
        toast.success(`Imported ${data.created} items`);
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (mode: "soft" | "hard") => {
    if (mode === "hard" && !confirm("This will permanently delete all your data. Are you sure?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/gdpr/delete?mode=${mode}`, { method: "DELETE" });
      toast.success(mode === "soft" ? "Data archived" : "All data deleted");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCoach = async () => {
    startTransition(async () => {
      const res = await fetch("/api/coach/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      if (res.ok) toast.success("Coach configuration saved");
      else toast.error("Failed to save coach config");
    });
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error("Unable to open billing portal");
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCheckout = async (priceId: string) => {
    if (!priceId) {
      toast.error("Stripe is not configured yet. Add NEXT_PUBLIC_STRIPE_PRICE_* keys to your environment.");
      return;
    }
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error(data.error ?? "Unable to start checkout");
    } catch {
      toast.error("Checkout failed");
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 sm:px-6 py-6 sm:py-10 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/app")}
            className="cursor-pointer gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, billing, integrations, and preferences.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full grid grid-cols-5 h-10">
            <TabsTrigger value="account" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
              <UserIcon className="h-3.5 w-3.5 hidden sm:inline" />
              Account
            </TabsTrigger>
            <TabsTrigger value="billing" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
              <CreditCard className="h-3.5 w-3.5 hidden sm:inline" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="integrations" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5 hidden sm:inline" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="coach" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5 hidden sm:inline" />
              AI Coach
            </TabsTrigger>
            <TabsTrigger value="data" className="cursor-pointer gap-1.5 text-xs sm:text-sm">
              <Shield className="h-3.5 w-3.5 hidden sm:inline" />
              Data
            </TabsTrigger>
          </TabsList>

          {/* ===================== ACCOUNT TAB ===================== */}
          <TabsContent value="account" className="mt-6 space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Your account details and preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User ID</label>
                    <p className="text-sm font-mono text-muted-foreground truncate">{user.id}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Terms & Privacy</label>
                    {settings?.accepted_terms_at ? (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        Accepted {new Date(settings.accepted_terms_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-amber-500" />
                        Not yet accepted
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</label>
                    <p className="text-sm font-medium">{planLabel}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Daily Capacity</h3>
                  <p className="text-xs text-muted-foreground">
                    Set how many tasks you can handle per day. Your {planLabel} plan allows up to {maxCapacity} tasks/day.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="capacity" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tasks per day
                      </label>
                      <Input
                        id="capacity"
                        type="number"
                        min={1}
                        max={maxCapacity}
                        value={capacity}
                        onChange={(e) => setCapacity(Math.min(Number(e.target.value), maxCapacity))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="timezone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Timezone
                      </label>
                      <select
                        id="timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer"
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      24-Hour Capacity Blocks
                    </label>
                    <div className="grid grid-cols-12 gap-1 p-3 rounded-lg bg-muted/50">
                      {Array.from({ length: 24 }, (_, i) => {
                        const isActive = i < capacity;
                        const isOverPlan = i >= maxCapacity;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              if (i + 1 <= maxCapacity) setCapacity(i + 1);
                            }}
                            disabled={isOverPlan}
                            className={`h-8 rounded-sm transition-colors ${
                              isOverPlan
                                ? "bg-muted-foreground/5 cursor-not-allowed"
                                : isActive
                                  ? "bg-primary hover:bg-primary/90 cursor-pointer"
                                  : "bg-muted-foreground/10 hover:bg-muted-foreground/20 cursor-pointer"
                            }`}
                            title={isOverPlan ? `Upgrade to unlock (max ${maxCapacity} on ${planLabel})` : `${i}:00 – ${i + 1}:00`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {capacity} of {maxCapacity} blocks allocated ({planLabel} plan).
                      {maxCapacity < 24 && " Upgrade for more."}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => startTransition(async () => { await saveSettings(); })} disabled={pending} className="cursor-pointer">
                    {pending ? "Saving..." : "Save preferences"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <ResourcePreallocationSettings
              initialBlocks={resourceBlocks}
              onSave={async (blocks) => {
                await fetch("/api/resource-blocks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ blocks }),
                  credentials: "include",
                });
              }}
            />
          </TabsContent>

          {/* ===================== BILLING TAB ===================== */}
          <TabsContent value="billing" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Subscription
                  <Badge variant={billingStatus === "active" ? "default" : "secondary"}>
                    {planLabel}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Manage your subscription and payment methods.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Usage meter — shown for all plans */}
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Usage</span>
                    <span className="text-xs text-muted-foreground">
                      {totalItemCount} / {billingStatus === "free"
                        ? MAX_FREE_ITEMS
                        : planLabel === "Basic"
                          ? MAX_BASIC_ITEMS
                          : "∞"} items
                    </span>
                  </div>
                  <Progress
                    value={
                      billingStatus === "free"
                        ? Math.min((totalItemCount / MAX_FREE_ITEMS) * 100, 100)
                        : planLabel === "Basic"
                          ? Math.min((totalItemCount / MAX_BASIC_ITEMS) * 100, 100)
                          : Math.min(totalItemCount, 5)
                    }
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {billingStatus === "free"
                      ? totalItemCount >= MAX_FREE_ITEMS
                        ? "You've reached the free tier limit. Upgrade to continue adding items."
                        : `${MAX_FREE_ITEMS - totalItemCount} items remaining on the free plan.`
                      : planLabel === "Basic"
                        ? `${Math.max(MAX_BASIC_ITEMS - totalItemCount, 0)} items remaining on Basic.`
                        : "Unlimited items on your plan."}
                  </p>
                </div>

                {billingStatus === "free" ? (
                  <>
                    <Separator />

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        Upgrade your plan
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Promo codes can be applied during checkout.
                      </p>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border p-4 space-y-2 hover:border-primary/50 transition-colors">
                          <p className="font-semibold text-sm">Basic</p>
                          <p className="text-2xl font-bold">$6<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                          <p className="text-xs text-muted-foreground">Up to {MAX_BASIC_ITEMS} items, calendar sync, streak tracking.</p>
                          <Button
                            className="w-full cursor-pointer"
                            variant="outline"
                            onClick={() => handleCheckout(STRIPE_PRICES.basic)}
                          >
                            Upgrade
                          </Button>
                        </div>
                        <div className="rounded-lg border-2 border-primary p-4 space-y-2 relative">
                          <Badge className="absolute -top-2.5 left-3 text-[10px]">Popular</Badge>
                          <p className="font-semibold text-sm">Pro</p>
                          <p className="text-2xl font-bold">$12<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                          <p className="text-xs text-muted-foreground">Unlimited items, AI coach expansions, priority support.</p>
                          <Button
                            className="w-full cursor-pointer"
                            onClick={() => handleCheckout(STRIPE_PRICES.pro)}
                          >
                            Upgrade
                          </Button>
                        </div>
                        <div className="rounded-lg border p-4 space-y-2 hover:border-primary/50 transition-colors">
                          <p className="font-semibold text-sm">Pro+</p>
                          <p className="text-2xl font-bold">$24<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                          <p className="text-xs text-muted-foreground">Teams, shared areas, and advanced reporting.</p>
                          <Button
                            className="w-full cursor-pointer"
                            variant="outline"
                            onClick={() => handleCheckout(STRIPE_PRICES.proplus)}
                          >
                            Upgrade
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 bg-muted/30 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{planLabel} Plan</p>
                        <p className="text-xs text-muted-foreground">
                          {planLabel === "Basic"
                            ? `Up to ${MAX_BASIC_ITEMS} items`
                            : "Unlimited items"}
                        </p>
                      </div>
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {billingProfile?.cancel_at_period_end ? "Canceling" : "Active"}
                      </Badge>
                    </div>

                    {billingProfile?.current_period_end && (
                      <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {billingProfile.cancel_at_period_end ? "Access until" : "Renews on"}
                          </span>
                          <span className="font-medium">
                            {new Date(billingProfile.current_period_end).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </span>
                        </div>
                        {billingProfile.payment_method_last4 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Payment method</span>
                            <span className="font-medium font-mono">
                              {billingProfile.payment_method_type === "card" ? "Card" : billingProfile.payment_method_type ?? "Card"} **** {billingProfile.payment_method_last4}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Manage your subscription, update payment method, or view invoices through the Stripe billing portal.
                    </p>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Billing Portal</p>
                    <p className="text-xs text-muted-foreground">Manage payment method, invoices, and subscription.</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleOpenPortal}
                    disabled={portalLoading}
                    className="cursor-pointer gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {portalLoading ? "Opening..." : "Open Portal"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===================== INTEGRATIONS TAB ===================== */}
          <TabsContent value="integrations" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integrations</CardTitle>
                <CardDescription>Connect external services to enhance your experience.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Google Calendar */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Google Calendar</p>
                        <p className="text-xs text-muted-foreground">
                          Sync your schedule to plan around meetings and events.
                        </p>
                      </div>
                    </div>
                    {calendarConnected ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch checked={calendarEnabled} onCheckedChange={setCalendarEnabled} />
                      <span className="text-xs text-muted-foreground">
                        {calendarEnabled ? "Calendar sync enabled" : "Calendar sync disabled"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleConnectCalendar}
                      disabled={connectingCalendar}
                      className="cursor-pointer"
                    >
                      {connectingCalendar ? "Connecting..." : calendarConnected ? "Reconnect" : "Connect"}
                    </Button>
                  </div>
                </div>

                {/* Placeholder for future integrations */}
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">More integrations coming soon (Notion, Slack, etc.)</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===================== AI COACH TAB ===================== */}
          <TabsContent value="coach" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Coach Configuration</CardTitle>
                <CardDescription>
                  Choose the AI provider and model that powers your coaching assistant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</label>
                    <Input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. gpt-4o-mini"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The AI coach supports multiple languages. Users can write tasks and ideas in any language and the coach will respond accordingly.
                </p>
                <div className="flex justify-end">
                  <Button onClick={handleSaveCoach} disabled={pending} className="cursor-pointer">
                    {pending ? "Saving..." : "Save coach config"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===================== DATA & PRIVACY TAB ===================== */}
          <TabsContent value="data" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export & Import</CardTitle>
                <CardDescription>Download your data or import from external tools.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export your data
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Download all your items, life areas, and workstreams. GDPR-compliant full data export.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleExport("json")} className="cursor-pointer">
                      Export JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="cursor-pointer">
                      Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="cursor-pointer">
                      Export Excel
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Import data
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Import tasks and ideas from a CSV file (e.g. exported from Notion, Trello, etc.).
                    CSV must include a &ldquo;title&rdquo; column. Optional columns: type, status, life_area, workstream, notes, scheduled_for, due_date.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportCsv(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer"
                  >
                    {importing ? "Importing..." : "Import from CSV"}
                  </Button>
                  {importResult && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                      <p>Created: {importResult.created} | Skipped: {importResult.skipped}</p>
                      {importResult.errors.length > 0 && (
                        <ul className="text-destructive list-disc list-inside">
                          {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  These actions are irreversible. Please export your data first.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium">Archive data</p>
                    <p className="text-xs text-muted-foreground">Soft delete — marks items as archived. Recoverable.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete("soft")}
                      disabled={deleting}
                      className="cursor-pointer"
                    >
                      {deleting ? "Processing..." : "Archive all data"}
                    </Button>
                  </div>
                  <div className="flex-1 rounded-lg border border-destructive/20 p-4 space-y-2">
                    <p className="text-sm font-medium text-destructive">Delete everything</p>
                    <p className="text-xs text-muted-foreground">Permanently remove all your data. Cannot be undone.</p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete("hard")}
                      disabled={deleting}
                      className="cursor-pointer"
                    >
                      {deleting ? "Deleting..." : "Delete all data"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
