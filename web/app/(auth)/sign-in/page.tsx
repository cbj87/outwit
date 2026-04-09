"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "forgot";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSignedUp = searchParams.get("welcome") === "1";
  const justReset = searchParams.get("reset") === "1";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setForgotSent(true);
    }
  }

  function switchToForgot() {
    setError(null);
    setForgotSent(false);
    setMode("forgot");
  }

  function switchToSignIn() {
    setError(null);
    setMode("signin");
  }

  return (
    <>
      {/* Success banners */}
      {justReset && mode === "signin" && (
        <div
          className="text-sm text-center rounded-lg px-4 py-3 mb-6"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-success) 15%, transparent)",
            color: "var(--color-success)",
          }}
        >
          Password updated! Sign in with your new password.
        </div>
      )}
      {justSignedUp && mode === "signin" && (
        <div
          className="text-sm text-center rounded-lg px-4 py-3 mb-6"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-success) 15%, transparent)",
            color: "var(--color-success)",
          }}
        >
          Account created! Sign in to get started.
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10">
        <h1
          className="text-4xl font-black tracking-[0.2em]"
          style={{ color: "var(--color-primary)" }}
        >
          OUTWIT OPEN
        </h1>
        <p
          className="mt-1 text-sm tracking-widest"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Survivor Season 50
        </p>
      </div>

      {mode === "signin" ? (
        <>
          {/* Sign In form */}
          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-lg text-base border outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-lg text-base border outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={switchToForgot}
                className="text-sm font-semibold"
                style={{ color: "var(--color-primary)" }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--color-error)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-lg text-base font-semibold mt-1 disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "#fff",
              }}
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <p
            className="text-sm text-center mt-8"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              Sign Up
            </Link>
          </p>
        </>
      ) : (
        <>
          {/* Forgot Password view */}
          {forgotSent ? (
            <div
              className="rounded-lg border p-5 space-y-2"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <p className="font-bold" style={{ color: "var(--color-text)" }}>
                Check your email
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                We sent a reset link to <strong>{email}</strong>. Follow it to set a new password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <p className="font-bold text-lg" style={{ color: "var(--color-text)" }}>
                Reset your password
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <input
                type="email"
                placeholder="Email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-lg text-base border outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />

              {error && (
                <p className="text-sm" style={{ color: "var(--color-error)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-lg text-base font-semibold disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "#fff",
                }}
              >
                {isLoading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="text-sm text-center mt-8">
            <button
              type="button"
              onClick={switchToSignIn}
              className="font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              Back to Sign In
            </button>
          </p>
        </>
      )}
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
