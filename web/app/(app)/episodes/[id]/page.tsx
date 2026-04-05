"use client";

import { useMemo, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useCastawayMap } from "@/hooks/useCastaways";
import { useTribeColors } from "@/hooks/useTribeColors";
import { useEpisodeSeenStatus } from "@/hooks/useEpisodeSeenStatus";
import { PageHeading } from "@/components/PageHeading";
import {
  EVENT_SCORES,
  EVENT_LABELS,
  ICKY_PICK_SCORES,
  getSurvivalPoints,
  PROPHECY_QUESTIONS,
} from "@shared/lib/constants";
import type { EventType } from "@shared/types";

const ICKY_EVENT_MAP: Partial<Record<EventType, string>> = {
  first_boot: "first_boot",
  made_jury: "jury",
  placed_3rd: "3rd",
  sole_survivor: "winner",
};

function pts(n: number) {
  return (n > 0 ? "+" : "") + n;
}

function PtsText({ value, className = "" }: { value: number; className?: string }) {
  const color =
    value > 0 ? "var(--color-success)" : value < 0 ? "var(--color-error)" : "var(--color-text-muted)";
  return (
    <span className={`font-semibold text-sm ${className}`} style={{ color }}>
      {pts(value)}
    </span>
  );
}

export default function EpisodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const episodeId = Number(id);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const castawayMap = useCastawayMap();
  const tribeColors = useTribeColors();
  const { seenEpisodes, markAllSeenThrough } = useEpisodeSeenStatus();

  const { data: episode, isLoading: episodeLoading } = useQuery({
    queryKey: ["episode", episodeId],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("episodes")
        .select("id, episode_number, is_merge, is_finale")
        .eq("id", episodeId)
        .single();
      return data;
    },
    enabled: !!session,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["episode-events", episodeId],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("castaway_events")
        .select("castaway_id, event_type")
        .eq("episode_id", episodeId);
      return data ?? [];
    },
    enabled: !!session,
  });

  const epNum = episode?.episode_number ?? 0;

  // Auto-mark this episode (and all prior) as seen when the page loads
  useEffect(() => {
    if (epNum > 0 && profile?.spoiler_protection && !seenEpisodes.has(epNum)) {
      markAllSeenThrough(epNum);
    }
  }, [epNum, profile?.spoiler_protection, seenEpisodes, markAllSeenThrough]);

  const { data: prophecyOutcomes = [] } = useQuery({
    queryKey: ["episode-prophecy", episodeId, epNum],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("prophecy_outcomes")
        .select("question_id, outcome")
        .eq("episode_number", epNum);
      return data ?? [];
    },
    enabled: !!session && !!epNum,
  });

  const grouped = useMemo(() => {
    if (!events.length || !castawayMap.size) return [];

    const byPlayer: Record<number, EventType[]> = {};
    for (const { castaway_id, event_type } of events) {
      if (!byPlayer[castaway_id]) byPlayer[castaway_id] = [];
      byPlayer[castaway_id].push(event_type as EventType);
    }

    const survivalPts = getSurvivalPoints(epNum || 1);

    return Object.entries(byPlayer)
      .map(([idStr, eventList]) => {
        const castawayId = Number(idStr);
        const castaway = castawayMap.get(castawayId);
        const survived = eventList.includes("survived_episode" as EventType);
        const notable = eventList.filter((e) => e !== "survived_episode");

        const trioEvents: { label: string; points: number }[] = [];
        let trioTotal = 0;
        if (survived) {
          trioEvents.push({ label: "Survived", points: survivalPts });
          trioTotal += survivalPts;
        }
        for (const e of notable) {
          const p = EVENT_SCORES[e] ?? 0;
          trioEvents.push({ label: EVENT_LABELS[e] ?? e, points: p });
          trioTotal += p;
        }

        const ickyEvents: { label: string; points: number }[] = [];
        let ickyTotal = 0;
        for (const e of notable) {
          const placement = ICKY_EVENT_MAP[e];
          if (placement && ICKY_PICK_SCORES[placement] !== undefined) {
            const p = ICKY_PICK_SCORES[placement];
            ickyEvents.push({ label: EVENT_LABELS[e] ?? e, points: p });
            ickyTotal += p;
          }
        }

        return {
          castawayId,
          name: castaway?.name ?? `#${castawayId}`,
          tribe: castaway?.original_tribe,
          trioEvents,
          trioTotal,
          ickyEvents,
          ickyTotal,
          hasNotable: notable.length > 0,
        };
      })
      .sort((a, b) => {
        if (a.hasNotable && !b.hasNotable) return -1;
        if (!a.hasNotable && b.hasNotable) return 1;
        if (Math.abs(b.trioTotal) !== Math.abs(a.trioTotal))
          return Math.abs(b.trioTotal) - Math.abs(a.trioTotal);
        return a.name.localeCompare(b.name);
      });
  }, [events, castawayMap, epNum]);

  type ProphecyResolution = { questionId: number; text: string; points: number; outcome: boolean };

  const prophecyResolutions = useMemo((): ProphecyResolution[] => {
    const results: ProphecyResolution[] = [];
    for (const o of prophecyOutcomes as { question_id: number; outcome: boolean }[]) {
      const q = PROPHECY_QUESTIONS.find((q) => q.id === o.question_id);
      if (q) results.push({ questionId: o.question_id, text: q.text, points: q.points, outcome: o.outcome });
    }
    return results;
  }, [prophecyOutcomes]);

  const isLoading = episodeLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="flex flex-col items-center py-20 gap-2">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Episode not found.</p>
        <Link href="/episodes" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← All Episodes
        </Link>
      </div>
    );
  }

  const survivalPts = getSurvivalPoints(epNum);
  const survivedCount = grouped.filter((g) => g.trioEvents.some((e) => e.label === "Survived")).length;

  return (
    <div className="space-y-3">
      <PageHeading
        title={`Episode ${epNum}`}
        subtitle={
          [episode.is_merge && "Merge", episode.is_finale && "Finale"]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      {/* Back link */}
      <Link href="/episodes" className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
        ← All Episodes
      </Link>

      {/* Survival context */}
      <div
        className="px-4 py-3 rounded-xl border text-sm"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
      >
        {survivedCount} castaways survived · <span className="font-semibold" style={{ color: "var(--color-success)" }}>+{survivalPts} pt{survivalPts !== 1 ? "s" : ""}</span> each
      </div>

      {/* Castaway cards */}
      <div className="space-y-2">
        {grouped.map((entry) => {
          const tribeColor = entry.tribe ? tribeColors[entry.tribe] : undefined;
          return (
            <div
              key={entry.castawayId}
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              {/* Castaway name */}
              <div className="flex items-center gap-2 px-4 py-3">
                {tribeColor && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tribeColor }} />
                )}
                <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  {entry.name}
                </span>
              </div>

              {/* Trusted Trio */}
              <div
                className="px-4 py-2.5 space-y-1.5 border-t"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                    TRUSTED TRIO
                  </span>
                  <PtsText value={entry.trioTotal} />
                </div>
                {entry.trioEvents.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{ev.label}</span>
                    <PtsText value={ev.points} className="text-xs" />
                  </div>
                ))}
              </div>

              {/* Icky Pick — only when applicable */}
              {entry.ickyEvents.length > 0 && (
                <div
                  className="px-4 py-2.5 space-y-1.5 border-t"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                      ICKY PICK
                    </span>
                    <PtsText value={entry.ickyTotal} />
                  </div>
                  {entry.ickyEvents.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{ev.label}</span>
                      <PtsText value={ev.points} className="text-xs" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Prophecy resolutions */}
      {prophecyResolutions.length > 0 && (
        <>
          <h2 className="text-base font-bold pt-2" style={{ color: "var(--color-text)" }}>
            Prophecy Picks
          </h2>
          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            {prophecyResolutions.map((res, i) => (
              <div
                key={res.questionId}
                className="flex items-center justify-between gap-3 px-4 py-3 border-t first:border-t-0"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span className="text-sm flex-1" style={{ color: "var(--color-text)" }}>
                  {res.text}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-xs font-black"
                    style={{ color: res.outcome ? "var(--color-success)" : "var(--color-error)" }}
                  >
                    {res.outcome ? "YES" : "NO"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {res.points}pt
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
