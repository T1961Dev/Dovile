import type { Metadata } from "next";

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

  // Note: Default data (settings, life areas, coach config) is automatically created
  // by the database trigger `handle_new_user()` when the user signs up.
  // No need to call seedDefaultsForUser() here.

  const settings = await getSettings(supabase);
  const timezone = settings?.timezone ?? "Europe/London";
  const awaitedParams = await Promise.resolve(searchParams);
  const date = awaitedParams?.date ?? getTodayISO(timezone);

  const [data, xpSummary, events] = await Promise.all([
    getDashboardData(date),
    getXpSummary(),
    getCalendarEventsForDate(user.id, date, timezone),
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
    />
  );
}

