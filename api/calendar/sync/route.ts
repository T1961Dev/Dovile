import { NextResponse } from "next/server";
import { z } from "zod";

import { exchangeCodeForTokens, saveCalendarCredentials } from "@/lib/calendar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  code: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = schema.safeParse(json);
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.message }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(payload.data.code);
    await saveCalendarCredentials(user.id, tokens);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to sync calendar" }, { status: 500 });
  }
}

