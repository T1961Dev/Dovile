"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const OAUTH_PROVIDERS: Provider[] = ["google"];

export function AuthLanding() {
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserSupabaseClient();

  const busy = loading || loadingProvider !== null;

  const handleOAuth = async (provider: Provider) => {
    setLoadingProvider(provider);
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes:
            provider === "google"
              ? "https://www.googleapis.com/auth/calendar offline_access openid email profile"
              : undefined,
        },
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); return; }
        if (data.user) {
          toast.success("Logged in successfully!");
          router.push("/app");
          router.refresh();
        }
      } else {
        if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) { toast.error(error.message); return; }
        if (data.user) {
          if (data.session) {
            toast.success("Account created!");
            router.push("/app");
            router.refresh();
          } else {
            toast.success("Account created! Check your email to verify.");
            setIsLogin(true);
          }
        }
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription className="text-sm">
            {isLogin
              ? "Sign in to your Life Scope account"
              : "Start planning your life beautifully"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />

            <Input
              type="password"
              placeholder={isLogin ? "Password" : "Password (min 6 characters)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLogin ? undefined : 6}
              disabled={busy}
            />

            {!isLogin && (
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={busy}
              />
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {loading
                ? isLogin ? "Signing in..." : "Creating account..."
                : isLogin ? "Sign in" : "Sign up"}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setPassword(""); setConfirmPassword(""); }}
              className="cursor-pointer text-sm text-primary hover:underline"
            >
              {isLogin ? "Don\u2019t have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="shrink-0 text-xs uppercase text-muted-foreground">Or continue with</span>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-3">
            {OAUTH_PROVIDERS.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="outline"
                className="w-full capitalize"
                disabled={busy}
                onClick={() => handleOAuth(provider)}
              >
                {loadingProvider === provider ? "Redirecting..." : `Continue with ${provider}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

