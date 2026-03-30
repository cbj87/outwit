"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

const PROPHECY_QUESTIONS = [
  { id: 1,  text: "Q mentions cancelling Christmas",                           points: 1 },
  { id: 2,  text: 'Someone says they\'re "playing chess not checkers"',        points: 1 },
  { id: 3,  text: "They play the eagle screech sound when Coach is on screen", points: 1 },
  { id: 4,  text: "Jeff uses his British accent",                              points: 2 },
  { id: 5,  text: "A live tribal occurs",                                      points: 2 },
  { id: 6,  text: "Someone is voted out with an idol in their pocket",         points: 2 },
  { id: 7,  text: "A player plays an idol for someone else",                   points: 2 },
  { id: 8,  text: "Someone plays a fake idol",                                 points: 3 },
  { id: 9,  text: "A unanimous vote happens post-merge, pre-final tribal",     points: 3 },
  { id: 10, text: "A player gives up individual immunity",                     points: 4 },
  { id: 11, text: "Someone plays Shot in the Dark successfully",               points: 4 },
  { id: 12, text: "A medical evacuation occurs",                               points: 4 },
  { id: 13, text: "A rock draw happens",                                       points: 4 },
  { id: 14, text: "There is an actual loved one visit",                        points: 4 },
  { id: 15, text: "The winner receives a unanimous jury vote",                 points: 4 },
  { id: 16, text: "Final tribal ends in a 4–4 tie",                           points: 4 },
];

type OutcomeState = boolean | null;

export default function ProphecyAdminPage() {
  const router = useRouter();
  const isCommissioner = useAuthStore((s) => s.isCommissioner);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const [outcomes, setOutcomes] = useState<Record<number, OutcomeState>>({});
  const [savedEpisodeNumbers, setSavedEpisodeNumbers] = useState<Record<number, number | null>>({});
  const [currentEpisode, setCurrentEpisode] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isCommissioner) return;

    const supabase = createClient();
    Promise.all([
      supabase.from("prophecy_outcomes").select("*"),
      supabase.from("season_config").select("current_episode").eq("id", 1).single(),
    ]).then(([outcomesResult, configResult]) => {
      const map: Record<number, OutcomeState> = {};
      const epMap: Record<number, number | null> = {};
      (outcomesResult.data ?? []).forEach((o: any) => {
        map[o.question_id] = o.outcome;
        epMap[o.question_id] = o.episode_number ?? null;
      });
      setOutcomes(map);
      setSavedEpisodeNumbers(epMap);
      if (configResult.data) setCurrentEpisode(configResult.data.current_episode ?? 0);
      setIsLoading(false);
    });
  }, [isAuthLoading, isCommissioner]);

  function cycleOutcome(questionId: number) {
    setOutcomes((prev) => {
      const current = prev[questionId] ?? null;
      const next = current === null ? true : current === true ? false : null;
      return { ...prev, [questionId]: next };
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const supabase = createClient();
      const updates = Object.entries(outcomes).map(([qId, outcome]) => {
        const qIdNum = parseInt(qId, 10);
        return {
          question_id: qIdNum,
          outcome,
          resolved_at: outcome !== null ? new Date().toISOString() : null,
          episode_number:
            outcome !== null
              ? (savedEpisodeNumbers[qIdNum] ?? (currentEpisode || null))
              : null,
        };
      });

      const { error } = await supabase
        .from("prophecy_outcomes")
        .upsert(updates, { onConflict: "question_id" });

      if (error) throw error;

      // Recalculate scores
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calculate-scores`;
      const fnRes = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({}),
      });

      if (!fnRes.ok) {
        const body = await fnRes.text();
        setSaveResult(`Saved, but score recalculation failed (${fnRes.status}): ${body}`);
      } else {
        setSaveResult("Outcomes saved and scores recalculated.");
      }
    } catch (e: any) {
      setSaveResult(`Error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!isCommissioner) {
    return (
      <div className="flex flex-col items-center py-20">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Access denied.</p>
      </div>
    );
  }

  const resolvedCount = Object.values(outcomes).filter((v) => v !== null && v !== undefined).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
            Prophecy Outcomes
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Tap a question to cycle: Pending → YES → NO → Pending
          </p>
        </div>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
          {resolvedCount}/{PROPHECY_QUESTIONS.length} resolved
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {PROPHECY_QUESTIONS.map((q) => {
          const outcome = outcomes[q.id] ?? null;
          return (
            <button
              key={q.id}
              onClick={() => cycleOutcome(q.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-snug" style={{ color: "var(--color-text)" }}>
                  {q.text}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {q.points} {q.points === 1 ? "pt" : "pts"}
                </div>
              </div>
              <OutcomeBadge outcome={outcome} />
            </button>
          );
        })}
      </div>

      {saveResult && (
        <p
          className="text-xs px-1"
          style={{
            color: saveResult.startsWith("Error")
              ? "var(--color-error)"
              : "var(--color-text-secondary)",
          }}
        >
          {saveResult}
        </p>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {isSaving ? "Saving..." : "Save Outcomes"}
      </button>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: OutcomeState }) {
  if (outcome === null || outcome === undefined) {
    return (
      <span
        className="text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0"
        style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)", backgroundColor: "var(--color-background)" }}
      >
        Pending
      </span>
    );
  }
  if (outcome === true) {
    return (
      <span
        className="text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0"
        style={{ color: "#22c55e", borderColor: "rgba(34,197,94,0.4)", backgroundColor: "rgba(34,197,94,0.1)" }}
      >
        YES ✓
      </span>
    );
  }
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0"
      style={{ color: "var(--color-error)", borderColor: "rgba(196,64,47,0.4)", backgroundColor: "rgba(196,64,47,0.1)" }}
    >
      NO ✗
    </span>
  );
}
