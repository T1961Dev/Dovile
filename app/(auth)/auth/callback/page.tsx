"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const exchange = async () => {
      const supabase = createBrowserSupabaseClient();
      const code = searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
      router.replace("/app");
    };
    void exchange();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-md border">
        Finishing sign-in&hellip;
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-md border">
          Loading&hellip;
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}