import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";

import {
  createSupabaseClient,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseUrl,
  type TypedSupabaseClient,
} from "@/lib/supabase";
import type { Database } from "@/types/database";

export const createServerSupabaseClient = cache(async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not set");
  }
  // Use dynamic import to avoid bundling issues with next/headers
  const { cookies: getCookies } = await import("next/headers");
  const cookieStore = await getCookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: Parameters<typeof cookieStore.set>[2]) {
        try {
          cookieStore.set(name, value, options);
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Skipping cookie set outside of a Server Action/Route Handler.");
          }
        }
      },
      remove(name: string, options?: any) {
        try {
          cookieStore.delete(name);
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Skipping cookie delete outside of a Server Action/Route Handler.");
          }
        }
      },
    } as any,
  });
});

export const createServiceRoleSupabaseClient = (): TypedSupabaseClient => {
  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createSupabaseClient(supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
};

