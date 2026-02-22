import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [areas, workstreams, items, xpEvents] = await Promise.all([
    (supabase.from("life_areas").select("*") as any).eq("user_id", user.id),
    (supabase.from("workstreams").select("*") as any).eq("user_id", user.id),
    (supabase.from("items").select("*") as any).eq("user_id", user.id),
    (supabase.from("xp_events").select("*") as any).eq("user_id", user.id),
  ]);

  const areaMap = new Map((areas.data ?? []).map((a: any) => [a.id, a.name]));
  const wsMap = new Map((workstreams.data ?? []).map((w: any) => [w.id, w.title]));

  const itemRows = (items.data ?? []).map((item: any) => ({
    Type: item.type,
    Title: item.title,
    Status: item.status,
    "Life Area": areaMap.get(item.life_area_id) ?? "",
    Workstream: wsMap.get(item.workstream_id) ?? "",
    "Scheduled For": item.scheduled_for ?? "",
    "Due Date": item.due_date ?? "",
    Notes: item.notes ?? "",
    "Created At": item.created_at ?? "",
    "Completed At": item.completed_at ?? "",
  }));

  const areaRows = (areas.data ?? []).map((a: any) => ({
    Name: a.name,
    Color: a.color ?? "",
    "Created At": a.created_at ?? "",
  }));

  const wsRows = (workstreams.data ?? []).map((w: any) => ({
    Title: w.title,
    Kind: w.kind,
    "Life Area": areaMap.get(w.life_area_id) ?? "",
    Description: w.description ?? "",
    Active: w.active !== false ? "Yes" : "No",
    "Created At": w.created_at ?? "",
  }));

  const xpRows = (xpEvents.data ?? []).map((e: any) => ({
    Action: e.action ?? "",
    XP: e.xp ?? "",
    "Created At": e.created_at ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), "Items");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaRows), "Life Areas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsRows), "Workstreams");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xpRows), "XP Events");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lifewheel-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
