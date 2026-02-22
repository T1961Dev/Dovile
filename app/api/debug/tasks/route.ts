import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTodayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const timezone = (settings as any)?.timezone ?? "Europe/London";
  const todayDate = getTodayISO(timezone);
  const utcDate = new Date().toISOString().slice(0, 10);

  // All items for this user (via RLS)
  const { data: allItems, error: allError } = await supabase
    .from("items")
    .select("id, type, status, scheduled_for, due_date, title, created_at")
    .order("created_at", { ascending: false });

  // Filtered tasks (same query as getTodayTasks)
  const isFutureDate = todayDate > utcDate;
  const statusFilter = isFutureDate
    ? ["pending", "in_progress"]
    : ["pending", "in_progress", "done"];

  const { data: filteredTasks, error: filterError } = await supabase
    .from("items")
    .select("id, type, status, scheduled_for, due_date, title, created_at")
    .eq("type", "task")
    .in("status", statusFilter)
    .neq("status", "archived")
    .or(
      `scheduled_for.eq.${todayDate},and(scheduled_for.is.null,due_date.eq.${todayDate}),and(scheduled_for.is.null,due_date.is.null)`,
    )
    .order("created_at", { ascending: true });

  return NextResponse.json({
    user_id: user.id,
    timezone,
    todayDate,
    utcDate,
    isFutureDate,
    statusFilter,
    allItems: {
      count: allItems?.length ?? 0,
      error: allError?.message ?? null,
      items: (allItems ?? []).map((i: any) => ({
        id: i.id?.slice(0, 8),
        type: i.type,
        status: i.status,
        scheduled_for: i.scheduled_for,
        due_date: i.due_date,
        title: i.title?.slice(0, 40),
      })),
    },
    filteredTasks: {
      count: filteredTasks?.length ?? 0,
      error: filterError?.message ?? null,
      items: (filteredTasks ?? []).map((i: any) => ({
        id: i.id?.slice(0, 8),
        type: i.type,
        status: i.status,
        scheduled_for: i.scheduled_for,
        due_date: i.due_date,
        title: i.title?.slice(0, 40),
      })),
    },
  });
}
