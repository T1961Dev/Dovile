"use client";

import { useState, useTransition, useEffect } from "react";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ResourcePreallocationSettings } from "@/components/ResourcePreallocationSettings";
import { DEFAULT_DAILY_CAPACITY, MAX_FREE_ITEMS } from "@/lib/constants";
import type { Database } from "@/types/database";
import type { ResourceBlock } from "@/lib/resource-capacity";

type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
type BillingRow = Database["public"]["Tables"]["billing_profiles"]["Row"];
type CoachConfigRow = Database["public"]["Tables"]["coach_configs"]["Row"];

const TIMEZONES = [
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

type SettingsClientProps = {
  user: User;
  settings: SettingsRow | null;
  billingProfile: BillingRow | null;
  calendarConnected: boolean;
  coachConfig: CoachConfigRow | null;
};

export function SettingsClient({
  user,
  settings,
  billingProfile,
  calendarConnected,
  coachConfig,
}: SettingsClientProps) {
  const [timezone, setTimezone] = useState(settings?.timezone ?? "Europe/London");
  const [capacity, setCapacity] = useState(settings?.daily_capacity ?? DEFAULT_DAILY_CAPACITY);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [provider, setProvider] = useState(coachConfig?.provider ?? "openai");
  const [model, setModel] = useState(coachConfig?.model ?? "gpt-4o-mini");
  const [calendarEnabled, setCalendarEnabled] = useState(calendarConnected);
  const [resourceBlocks, setResourceBlocks] = useState<ResourceBlock[]>([]);
  const [pending, startTransition] = useTransition();

  // Load resource blocks on mount
  useEffect(() => {
    fetch("/api/resource-blocks", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.blocks) {
          setResourceBlocks(data.blocks);
        }
      })
      .catch(console.error);
  }, []);

  const handleSaveSettings = () => {
    startTransition(async () => {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          daily_capacity: capacity,
          calendar_provider: calendarEnabled ? "google" : null,
        }),
      });
    });
  };

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const response = await fetch("/api/calendar/connect");
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setConnectingCalendar(false);
    }
  };

  const handleExport = async () => {
    const response = await fetch("/api/gdpr/export");
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lifewheel-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (mode: "soft" | "hard") => {
    setDeleting(true);
    try {
      await fetch(`/api/gdpr/delete?mode=${mode}`, { method: "DELETE" });
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCoach = async () => {
    startTransition(async () => {
      await fetch("/api/coach/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
    });
  };

  const billingStatus = billingProfile?.subscription_status ?? "free";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Tune your capacity, integrations, and privacy.</p>
      </div>

      <Card className="rounded-3xl border border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase text-slate-400">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Google Calendar</p>
              <p className="text-xs text-slate-500">
                Sync your schedule to the inner watch ring.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={calendarEnabled} onCheckedChange={setCalendarEnabled} />
              <Button
                variant="outline"
                className="rounded-full"
                onClick={handleConnectCalendar}
                disabled={connectingCalendar}
              >
                {calendarConnected ? "Reconnect" : "Connect"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Daily Capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="capacity" className="text-xs uppercase text-slate-400">
                Tasks per day
              </label>
              <Input
                id="capacity"
                type="number"
                min={1}
                max={24}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                className="mt-2 rounded-full"
              />
            </div>
            <div>
              <label htmlFor="timezone" className="text-xs uppercase text-slate-400">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="mt-2 w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
            onClick={handleSaveSettings}
            disabled={pending}
          >
            Save preferences
          </Button>
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

      <Card className="rounded-3xl border border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">AI Coach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase text-slate-400">Provider</label>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="mt-2 w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-slate-400">Model</label>
              <Input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-2 rounded-full"
              />
            </div>
          </div>
          <Button
            className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
            onClick={handleSaveCoach}
            disabled={pending}
          >
            Save coach config
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Usage & Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Plan</p>
              <p className="text-xs text-slate-500">{billingStatus}</p>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                void fetch("/api/stripe/create-portal", { method: "POST" })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.url) window.location.href = data.url;
                  });
              }}
            >
              Open portal
            </Button>
          </div>
          <Separator />
          <p className="text-xs text-slate-500">
            Free tier includes {MAX_FREE_ITEMS} total items. Upgrade to unlock unlimited circles.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Data & Privacy</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-600">
          <Button variant="outline" className="rounded-full" onClick={handleExport}>
            Export your data
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => handleDelete("soft")}
              disabled={deleting}
            >
              Soft delete (archive)
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={() => handleDelete("hard")}
              disabled={deleting}
            >
              Delete everything
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

