"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    </>
  );
}
