"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            // Additional metadata if needed
          },
        },
      });

      if (error) {
        console.error("Signup error:", error);
        toast.error(error.message || "Failed to create account. Please try again.");
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.session) {
          // User is automatically signed in (email confirmation disabled)
          toast.success("Account created successfully!");
          router.push("/app");
          router.refresh();
        } else {
          // Email confirmation required
          toast.success("Account created! Please check your email to verify your account.");
          router.push("/login");
        }
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF9F4] px-6 py-12">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0B1918]">
            Create your account
          </h1>
          <p className="text-sm text-[#195552]">
            Start planning your life beautifully
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-[#0B1918]">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-full border-[#0EA8A8]/25 bg-white"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-[#0B1918]">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="rounded-full border-[#0EA8A8]/25 bg-white"
              disabled={loading}
            />
            <p className="text-xs text-[#195552]/70">Must be at least 6 characters</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-[#0B1918]">
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="rounded-full border-[#0EA8A8]/25 bg-white"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#0EA8A8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0C8F90] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <div className="text-center text-sm text-[#195552]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0EA8A8] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

