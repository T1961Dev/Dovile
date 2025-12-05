import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
}

export type TypedSupabaseClient = SupabaseClient<Database>;

export const createSupabaseClient = (
  key: string,
  options?: SupabaseClientOptions<"public">,
): TypedSupabaseClient => createClient<Database>(supabaseUrl!, key, options);

