"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Please enter your display name.");
      return;
    }
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName.trim() } },
    });
    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/sign-in?welcome=1");
    }
  }

  return (
    <>
      {/* Header */}
      <div className="text-center mb-8">
        <h1
          className="text-3xl font-extrabold tracking-[0.15em]"
          style={{ color: "var(--color-primary)" }}
        >
          Join Outwit Open
        </h1>
        <p
          className="mt-1 text-sm tracking-widest"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Survivor Season 50
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label
            className="block text-xs font-semibold tracking-wide mb-1.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Display Name
          </label>
          <input
            type="text"
            placeholder="How you'll appear on the leaderboard"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3.5 rounded-lg text-base border outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div>
          <label
            className="block text-xs font-semibold tracking-wide mb-1.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Email
          </label>
          <input
            type="email"
            placeholder="your@email.com"
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
        </div>

        <div>
          <label
            className="block text-xs font-semibold tracking-wide mb-1.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Password
          </label>
          <input
            type="password"
            placeholder="At least 6 characters"
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
        </div>

        <div>
          <label
            className="block text-xs font-semibold tracking-wide mb-1.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="Repeat your password"
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
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--color-error)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 rounded-lg text-base font-semibold mt-2 disabled:opacity-50 cursor-pointer"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "#fff",
          }}
        >
          {isLoading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      {/* Footer */}
      <p
        className="text-sm text-center mt-8"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          Sign In
        </Link>
      </p>
    </>
  );
}
