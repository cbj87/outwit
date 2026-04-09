"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Exchange the token from the email link for a session.
  useEffect(() => {
    async function verifyToken() {
      const supabase = createClient();

      // PKCE flow: ?code=xxx
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setIsVerifying(false);
        if (error) setTokenError(error.message);
        return;
      }

      // Token hash flow: ?token_hash=xxx&type=recovery
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        setIsVerifying(false);
        if (error) setTokenError(error.message);
        return;
      }

      // No recognisable token in the URL
      setIsVerifying(false);
      setTokenError("Invalid or expired reset link. Please request a new one.");
    }

    verifyToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/sign-in?reset=1");
    }
  }

  return (
    <>
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

      {isVerifying ? (
        <p className="text-sm text-center" style={{ color: "var(--color-text-secondary)" }}>
          Verifying reset link…
        </p>
      ) : tokenError ? (
        <div
          className="rounded-lg border p-5 space-y-3"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <p className="font-bold" style={{ color: "var(--color-text)" }}>
            Link invalid or expired
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {tokenError}
          </p>
          <button
            type="button"
            onClick={() => router.push("/sign-in")}
            className="text-sm font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-3">
          <p className="font-bold text-lg" style={{ color: "var(--color-text)" }}>
            Set new password
          </p>
          <input
            type="password"
            placeholder="New password"
            autoComplete="new-password"
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
          <input
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isLoading ? "Updating…" : "Update Password"}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
