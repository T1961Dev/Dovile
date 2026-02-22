import type { Metadata } from "next";

export const dynamic = "force-dynamic";

import { AuthLanding } from "@/components/AuthLanding";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getCalendarEventsForDate } from "@/lib/calendar";
import { getDashboardData, getSettings } from "@/lib/queries";
import { getTodayISO } from "@/lib/dates";
import { getXpSummary } from "@/lib/gamification";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AppPageProps = {
  searchParams?: {
    date?: string;
  };
};

export const metadata: Metadata = {
  title: "LifeWheel · Dashboard",
};

export default async function AppPage({ searchParams }: AppPageProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthLanding />;
  }

  const settings = await getSettings(supabase, user.id);
  const timezone = settings?.timezone ?? "Europe/London";
  const awaitedParams = await Promise.resolve(searchParams);
  const date = awaitedParams?.date ?? getTodayISO(timezone);

  const [data, xpSummary, events, billingResult] = await Promise.all([
    getDashboardData(date),
    getXpSummary(),
    getCalendarEventsForDate(user.id, date, timezone),
    (supabase.from("billing_profiles") as any).select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <DashboardClient
      user={user}
      date={date}
      timezone={timezone}
      data={data}
      settings={settings}
      xpSummary={xpSummary}
      events={events}
      billingProfile={billingResult.data ?? null}
    />
  );
}
