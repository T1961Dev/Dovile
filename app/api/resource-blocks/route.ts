import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const resourceBlockSchema = z.object({
  name: z.string().min(1),
  start_hour: z.number().int().min(0).max(23),
  duration_hours: z.number().min(0.25).max(24),
  color: z.string(),
  active: z.boolean(),
});

const createSchema = z.object({
  blocks: z.array(resourceBlockSchema),
});

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await (supabase
    .from("resource_blocks")
    .select("*") as any)
    .eq("user_id", user.id)
    .order("start_hour", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocks: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = createSchema.safeParse(json);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  // Delete existing blocks and insert new ones
  await (supabase.from("resource_blocks") as any).delete().eq("user_id", user.id);

  const inserts = payload.data.blocks.map((block) => ({
    user_id: user.id,
    ...block,
  }));

  const { data, error } = await (supabase
    .from("resource_blocks") as any)
    .insert(inserts)
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocks: data });
}

