import { NextResponse } from "next/server";
import { checkItemQuota } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV is empty or has no data rows" }, { status: 400 });
  }

  const first = rows[0];
  if (!first.title) {
    return NextResponse.json({ error: "CSV must have a 'title' column" }, { status: 400 });
  }

  const quotaOk = await checkItemQuota(user.id);
  if (!quotaOk) {
    return NextResponse.json(
      { error: "You've reached your plan's item limit. Upgrade to add more.", code: "quota_exceeded" },
      { status: 402 },
    );
  }

  const { data: existingAreas } = await (supabase.from("life_areas").select("*") as any).eq("user_id", user.id);
  const areaNameMap = new Map<string, string>();
  for (const a of existingAreas ?? []) {
    areaNameMap.set(a.name.toLowerCase(), a.id);
  }

  const { data: existingWs } = await (supabase.from("workstreams").select("*") as any).eq("user_id", user.id);
  const wsNameMap = new Map<string, string>();
  for (const w of existingWs ?? []) {
    wsNameMap.set(w.title.toLowerCase(), w.id);
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = row.title?.trim();
    if (!title) { skipped++; continue; }

    const type = (row.type ?? "task").toLowerCase();
    if (type !== "task" && type !== "idea") {
      errors.push(`Row ${i + 2}: invalid type "${row.type}"`);
      skipped++;
      continue;
    }

    let lifeAreaId: string | null = null;
    if (row.life_area) {
      lifeAreaId = areaNameMap.get(row.life_area.toLowerCase()) ?? null;
    }

    let workstreamId: string | null = null;
    if (row.workstream) {
      workstreamId = wsNameMap.get(row.workstream.toLowerCase()) ?? null;
    }

    const insert: Record<string, unknown> = {
      user_id: user.id,
      title,
      type,
      status: row.status || "pending",
      life_area_id: lifeAreaId,
      workstream_id: workstreamId,
      notes: row.notes || null,
      scheduled_for: row.scheduled_for || null,
      due_date: row.due_date || null,
    };

    const { error } = await (supabase.from("items") as any).insert(insert);
    if (error) {
      errors.push(`Row ${i + 2}: ${error.message}`);
      skipped++;
    } else {
      created++;
    }
  }

  return NextResponse.json({
    created,
    skipped,
    total: rows.length,
    errors: errors.slice(0, 20),
  });
}
