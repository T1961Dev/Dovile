import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  rating: z.number().int().min(1).max(10).optional(),
  color: z.string().optional(),
  name: z.string().optional(),
});

type RouteParams = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = updateSchema.safeParse(json);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (payload.data.rating !== undefined) updates.rating = payload.data.rating;
  if (payload.data.color !== undefined) updates.color = payload.data.color;
  if (payload.data.name !== undefined) updates.name = payload.data.name;

  const { data, error } = await (supabase
    .from("life_areas") as any)
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ area: data });
}

