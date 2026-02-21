import { NextResponse } from "next/server";

import { createAuthUrl } from "@/lib/calendar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = crypto.randomUUID();
  const url = await createAuthUrl(state);
  return NextResponse.json({ url, state });
}

