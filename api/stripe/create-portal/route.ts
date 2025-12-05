import { NextResponse } from "next/server";

import { createPortalSession } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await createPortalSession(user.id, request.headers.get("origin") ?? "http://localhost:3000", user.email);
  return NextResponse.json({ url: session.url });
}

