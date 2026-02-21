import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  token: z.string().min(1),
  pageId: z.string().min(1),
  lifeAreaId: z.string().uuid().optional(),
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

  const response = await fetch(`https://api.notion.com/v1/blocks/${payload.data.pageId}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${payload.data.token}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch Notion page" }, { status: 400 });
  }

  const data = await response.json();
  const ideas: string[] = [];
  for (const block of (data.results ?? []) as NotionBlock[]) {
    if (block.type === "paragraph") {
      const text =
        block.paragraph?.rich_text?.map((text) => text.plain_text).join("") ?? "";
      if (text) ideas.push(text);
    }
  }

  if (ideas.length === 0) {
    return NextResponse.json({ imported: 0 });
  }

  const lifeAreaId = payload.data.lifeAreaId ?? (await (supabase
    .from("life_areas")
    .select("id") as any)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()).data?.id;

  if (!lifeAreaId) {
    return NextResponse.json({ error: "Life area required" }, { status: 400 });
  }

  const inserts = ideas.map((title) => ({
    user_id: user.id,
    life_area_id: lifeAreaId,
    title,
    type: "idea",
    status: "pending",
  }));

  const { error } = await (supabase.from("items") as any).insert(inserts);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: inserts.length });
}

type NotionBlock = {
  id: string;
  type: string;
  paragraph?: {
    rich_text?: Array<{ plain_text: string }>;
  };
};

