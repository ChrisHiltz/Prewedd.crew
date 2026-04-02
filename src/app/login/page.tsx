"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, Check } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            PreWedd Crew
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Sign in with your email to continue
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-success/30 bg-success-fill p-6 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-success/20">
              <Check className="size-5 text-success" />
            </div>
            <h2 className="text-base font-semibold text-neutral-900">
              Check your email
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              We sent a magic link to{" "}
              <span className="font-medium text-neutral-700">{email}</span>.
              Click the link to sign in.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 text-sm font-medium text-primary hover:text-primary-hover"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !email}
              className="h-10 w-full gap-2 bg-primary text-white hover:bg-primary-hover"
            >
              {loading ? (
                "Sending..."
              ) : (
                <>
                  Send Magic Link
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
