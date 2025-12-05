import { randomUUID } from "node:crypto";

import { google } from "googleapis";

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/types/entities";

const calendarScopes = ["https://www.googleapis.com/auth/calendar.readonly"];

export async function getCalendarEventsForDate(userId: string, date: string, timezone: string): Promise<CalendarEvent[]> {
  const supabase = await createServiceRoleSupabaseClient();
  const { data: credential } = await (supabase
    .from("calendar_credentials")
    .select("*") as any)
    .eq("user_id", userId)
    .maybeSingle();

  if (!credential || !credential.refresh_token) {
    return [];
  }

  const auth = getOAuthClient();
  auth.setCredentials({
    access_token: credential.access_token ?? undefined,
    refresh_token: credential.refresh_token ?? undefined,
    scope: credential.scope ?? calendarScopes.join(" "),
    token_type: credential.token_type ?? undefined,
    expiry_date: credential.expiry_date ? new Date(credential.expiry_date).getTime() : undefined,
  });

  const calendar = google.calendar({ version: "v3", auth });
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);

  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    timeZone: timezone,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (
    data.items?.map((item) => ({
      id: item.id ?? randomUUID(),
      title: item.summary ?? "Busy",
      start: item.start?.dateTime ?? `${date}T00:00:00`,
      end: item.end?.dateTime ?? `${date}T01:00:00`,
      color: item.colorId ? mapColor(item.colorId) : undefined,
      source: "google",
    })) ?? []
  );
}

export async function saveCalendarCredentials(userId: string, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const payload = {
    user_id: userId,
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    scope: tokens.scope ?? null,
    token_type: tokens.token_type ?? null,
    expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  };

  const { error } = await (supabase.from("calendar_credentials") as any).upsert(payload);
  if (error) {
    throw error;
  }
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth environment variables are not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function createAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: calendarScopes,
    prompt: "consent",
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function listCalendars(userId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new Error("Unauthorized");
  }

  const events = await getCalendarEventsForDate(userId, new Date().toISOString().split("T")[0]!, user?.app_metadata?.timezone ?? "UTC");
  return events;
}

function mapColor(colorId: string) {
  const palette: Record<string, string> = {
    "1": "#7986CB",
    "2": "#33B679",
    "3": "#8E24AA",
    "4": "#E67C73",
    "5": "#F6BF26",
    "6": "#F4511E",
    "7": "#039BE5",
    "8": "#616161",
    "9": "#3F51B5",
    "10": "#0B8043",
    "11": "#D60000",
  };
  return palette[colorId] ?? "#2563EB";
}

