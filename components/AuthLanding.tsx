"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Provider } from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Simplified auth - email/password is primary, OAuth providers optional
const PROVIDERS: Provider[] = ["google"]; // Google auth is available but email/password is primary

export function AuthLanding() {
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<Provider | "email" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserSupabaseClient();

  const handleSignIn = async (provider: Provider) => {
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

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        if (data.user) {
          toast.success("Logged in successfully!");
          router.push("/app");
          router.refresh();
        }
      } else {
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        if (data.user) {
          toast.success("Account created! Check your email to verify your account.");
          router.push("/app");
          router.refresh();
        }
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    if (typeof email !== "string") {
      return;
    }
    setLoadingProvider("email");
    try {
      await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      toast.success("Check your email for the magic link!");
    } catch (error) {
      toast.error("Failed to send magic link");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF9F4] px-6 py-12">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0B1918]">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-[#195552]">
            {isLogin
              ? "Sign in to your Life Scope account"
              : "Start planning your life beautifully"}
          </p>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailPassword} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-full border-[#0EA8A8]/25 bg-white"
              disabled={loading || loadingProvider !== null}
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-full border-[#0EA8A8]/25 bg-white"
                disabled={loading || loadingProvider !== null}
              />
            </div>
          )}

          {isLogin && (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-full border-[#0EA8A8]/25 bg-white"
                disabled={loading || loadingProvider !== null}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || loadingProvider !== null}
            className="w-full rounded-full bg-[#0EA8A8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0C8F90] disabled:opacity-50"
          >
            {loading
              ? isLogin
                ? "Signing in..."
                : "Creating account..."
              : isLogin
                ? "Sign in"
                : "Sign up"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setPassword("");
            }}
            className="text-sm text-[#0EA8A8] hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#0EA8A8]/20" />
          </div>
          <div className="relative flex justify-center text-xs uppercase text-[#195552]">
            <span className="bg-white px-2">Or continue with</span>
          </div>
        </div>

        {/* OAuth Providers */}
        <div className="space-y-3">
          {PROVIDERS.map((provider) => (
            <button
              key={provider}
              disabled={loading || loadingProvider !== null}
              onClick={() => handleSignIn(provider)}
              className="w-full rounded-full border border-[#0EA8A8]/25 bg-white px-4 py-2 text-sm font-medium capitalize text-[#0B1918] shadow-sm transition hover:bg-[#0EA8A8]/5 disabled:opacity-50"
            >
              {loadingProvider === provider ? "Redirecting..." : `Continue with ${provider}`}
            </button>
          ))}
        </div>

        {/* Magic Link Option */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#0EA8A8]/20" />
          </div>
          <div className="relative flex justify-center text-xs uppercase text-[#195552]">
            <span className="bg-white px-2">Or</span>
          </div>
        </div>

        <form onSubmit={handleMagicLink} className="space-y-4">
          <Input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            className="rounded-full border-[#0EA8A8]/25 bg-white"
            disabled={loading || loadingProvider !== null}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={loading || loadingProvider !== null}
            className="w-full rounded-full border-[#0EA8A8]/25 bg-white px-4 py-2 text-sm font-semibold text-[#0EA8A8] hover:bg-[#0EA8A8]/10 disabled:opacity-50"
          >
            {loadingProvider === "email" ? "Sending magic link..." : "Email me a magic link"}
          </Button>
        </form>
      </div>
    </div>
  );
}

