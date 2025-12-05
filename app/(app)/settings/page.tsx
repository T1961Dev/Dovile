import { AuthLanding } from "@/components/AuthLanding";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthLanding />;
  }

  const [settings, billingProfile, calendarCredentials, coachConfig] = await Promise.all([
    (supabase.from("settings").select("*") as any).eq("user_id", user.id).maybeSingle(),
    (supabase.from("billing_profiles").select("*") as any).eq("user_id", user.id).maybeSingle(),
    (supabase.from("calendar_credentials").select("access_token") as any).eq("user_id", user.id).maybeSingle(),
    (supabase.from("coach_configs").select("*") as any).eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <SettingsClient
      user={user}
      settings={settings.data}
      billingProfile={billingProfile.data}
      calendarConnected={Boolean(calendarCredentials.data?.access_token)}
      coachConfig={coachConfig.data}
    />
  );
}

