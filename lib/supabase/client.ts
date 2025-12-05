import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import type { Database } from "@/types/database";

export const createBrowserSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not set");
  }
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
};

