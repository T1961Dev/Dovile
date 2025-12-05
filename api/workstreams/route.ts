import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const createWorkstreamSchema = z.object({
  lifeAreaId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(["project", "process", "habit"]),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  console.log("[api/workstreams] POST");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = createWorkstreamSchema.safeParse(json);

  if (!payload.success) {
    console.warn("[api/workstreams] invalid payload", payload.error.flatten());
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  const { data, error, status } = await (supabase
    .from("workstreams") as any)
    .insert({
      user_id: user.id,
      life_area_id: payload.data.lifeAreaId,
      title: payload.data.title,
      description: payload.data.description ?? null,
      kind: payload.data.kind,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[api/workstreams] supabase error", error);
    return NextResponse.json(
      { error: error?.message ?? "Unable to create workstream" },
      { status: status || 500 },
    );
  }

  console.log("[api/workstreams] created", data.id);
  return NextResponse.json({ workstream: data }, { status: 201 });
}

