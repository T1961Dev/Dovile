import { NextRequest, NextResponse } from "next/server";

import { getCalendarEventsForDate } from "@/lib/calendar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const timezone = url.searchParams.get("tz") ?? "Europe/London";

  if (!date) {
    return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await getCalendarEventsForDate(user.id, date, timezone);
  return NextResponse.json({ events });
}

