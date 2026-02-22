import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
  }
  return lines.join("\r\n");
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [areas, workstreams, items] = await Promise.all([
    (supabase.from("life_areas").select("*") as any).eq("user_id", user.id),
    (supabase.from("workstreams").select("*") as any).eq("user_id", user.id),
    (supabase.from("items").select("*") as any).eq("user_id", user.id),
  ]);

  const areaMap = new Map((areas.data ?? []).map((a: any) => [a.id, a.name]));
  const wsMap = new Map((workstreams.data ?? []).map((w: any) => [w.id, w.title]));

  const headers = [
    "type", "title", "status", "life_area", "workstream", "scheduled_for",
    "due_date", "notes", "created_at", "completed_at",
  ];

  const rows = (items.data ?? []).map((item: any) => ({
    type: item.type,
    title: item.title,
    status: item.status,
    life_area: areaMap.get(item.life_area_id) ?? "",
    workstream: wsMap.get(item.workstream_id) ?? "",
    scheduled_for: item.scheduled_for ?? "",
    due_date: item.due_date ?? "",
    notes: item.notes ?? "",
    created_at: item.created_at ?? "",
    completed_at: item.completed_at ?? "",
  }));

  const csv = toCsv(headers, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lifewheel-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
