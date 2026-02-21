import { NextRequest, NextResponse } from "next/server";

import { exchangeCodeForTokens, saveCalendarCredentials } from "@/lib/calendar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!user || !code) {
    return NextResponse.redirect(new URL("/settings?calendar=error", request.url));
  }

  const tokens = await exchangeCodeForTokens(code);
  await saveCalendarCredentials(user.id, tokens);

  return NextResponse.redirect(new URL("/settings?calendar=connected", request.url));
}

