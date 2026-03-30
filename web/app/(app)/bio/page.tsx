"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useBioQuestions } from "@/hooks/useBioQuestions";

export default function BioPage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setProfile = useAuthStore((s) => s.setProfile);
  const { questions, isLoading: questionsLoading } = useBioQuestions();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.survivor_bio) {
      setAnswers({ ...(profile.survivor_bio as Record<string, string>) });
    }
  }, [profile?.survivor_bio]);

  const hasChanges = (() => {
    const existing = (profile?.survivor_bio as Record<string, string>) ?? {};
    for (const q of questions) {
      const current = (answers[q.key] ?? "").trim();
      const original = (existing[q.key] ?? "").trim();
      if (current !== original) return true;
    }
    return false;
  })();

  async function handleSave() {
    if (!profile || !hasChanges) return;
    setIsSaving(true);
    setError(null);

    const cleaned: Record<string, string> = {};
    for (const q of questions) {
      const val = (answers[q.key] ?? "").trim();
      if (val) cleaned[q.key] = val;
    }

    const supabase = createClient();
    const { error: err } = await supabase
      .from("profiles")
      .update({ survivor_bio: cleaned, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    setIsSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    // Refresh profile in store
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .single();
    if (data) setProfile(data);

    router.push("/profile");
  }

  if (isLoading || questionsLoading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!profile) {
    router.replace("/sign-in");
    return null;
  }

  const answeredCount = questions.filter((q) => (answers[q.key] ?? "").trim()).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
          Survivor Bio
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="text-sm font-bold px-4 py-1.5 rounded-lg text-white disabled:opacity-40"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Fill out your Survivor bio so your league-mates can get to know your game.{" "}
        <span style={{ color: "var(--color-text-muted)" }}>
          {answeredCount} of {questions.length} answered
        </span>
      </p>

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm border"
          style={{
            color: "var(--color-error)",
            backgroundColor: "rgba(255,59,48,0.06)",
            borderColor: "rgba(255,59,48,0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((q) => (
          <div
            key={q.key}
            className="px-4 py-3 rounded-xl"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <label
              className="text-xs font-bold uppercase tracking-wider mb-2 block"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {q.label}
            </label>
            {q.key === "bio" ? (
              <textarea
                value={answers[q.key] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                placeholder="Write your Survivor bio..."
                rows={4}
                className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                style={{
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              />
            ) : (
              <input
                type="text"
                value={answers[q.key] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Your answer..."
                className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                style={{
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom save */}
      <button
        onClick={handleSave}
        disabled={!hasChanges || isSaving}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {isSaving ? "Saving..." : "Save Bio"}
      </button>
    </div>
  );
}
