import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_XP_PER_TASK } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await (supabase
    .from("items")
    .select("*") as any)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    console.error("Failed to fetch item:", { id: params.id, error: error?.message, user_id: user.id });
    return NextResponse.json({ error: error?.message ?? "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}

const updateItemSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "in_progress", "done", "archived"]).optional(),
  scheduledFor: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  workstreamId: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = updateItemSchema.safeParse(json);
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (payload.data.title !== undefined) updates.title = payload.data.title;
  if (payload.data.notes !== undefined) updates.notes = payload.data.notes;
  if (payload.data.scheduledFor !== undefined) updates.scheduled_for = payload.data.scheduledFor;
  if (payload.data.dueDate !== undefined) updates.due_date = payload.data.dueDate;
  if (payload.data.workstreamId !== undefined) updates.workstream_id = payload.data.workstreamId;

  if (payload.data.status) {
    updates.status = payload.data.status;
    if (payload.data.status === "done") {
      updates.completed_at = new Date().toISOString();
    } else if (payload.data.status === "in_progress") {
      // The database trigger will automatically set other in_progress tasks to pending
      // But we can also do it here for extra safety
      await (supabase
        .from("items") as any)
        .update({ status: "pending" })
        .eq("user_id", user.id)
        .eq("type", "task")
        .eq("status", "in_progress")
        .neq("id", params.id);
    }
  }

  const { data, error } = await (supabase
    .from("items") as any)
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (payload.data.status === "done") {
    const xpEvent = await (supabase.from("xp_events") as any).insert({
      user_id: user.id,
      item_id: params.id,
      kind: "task_complete",
      amount: DEFAULT_XP_PER_TASK,
      meta: {
        source: "manual",
      },
    });
    if (xpEvent.error) {
      console.error("Failed to log XP event", xpEvent.error);
    }
  }

  return NextResponse.json({ item: data });
}

