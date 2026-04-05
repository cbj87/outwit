"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useSeasonConfig } from "@/hooks/useSeasonConfig";
import { useEpisodeSeenStatus } from "@/hooks/useEpisodeSeenStatus";
import { useCastawayMap } from "@/hooks/useCastaways";
import { useTribeColors } from "@/hooks/useTribeColors";
import { PROPHECY_QUESTIONS, EVENT_LABELS, EVENT_SCORES, getSurvivalPoints } from "@shared/lib/constants";
import type {
  Profile,
  Picks,
  ProphecyAnswer,
  ProphecyOutcome,
  ScoreCache,
  ScoreCacheTrioDetail,
  ScoreSnapshot,
  CastawayEvent,
  EventType,
} from "@shared/types";

const AVATAR_COLORS = [
  "#C4402F", "#2E7D32", "#1565C0", "#F57F17",
  "#7B1FA2", "#00838F", "#D84315", "#4527A0",
  "#00695C", "#AD1457", "#1B5E20", "#0D47A1",
];

const ICKY_PLACEMENT_LABELS: Record<string, string> = {
  first_boot: "First Boot",
  pre_merge: "Pre-Merge Boot",
  jury: "Jury Member",
  "3rd": "3rd Place",
  runner_up: "Runner-Up",
  winner: "Winner",
};

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function pts(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function ptsColor(n: number) {
  if (n > 0) return "var(--color-success)";
  if (n < 0) return "var(--color-error)";
  return "var(--color-text-secondary)";
}

function SectionHeader({ title, points }: { title: string; points: number }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2">
      <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-text-secondary)" }}>
        {title}
      </h2>
      <span className="text-sm font-bold" style={{ color: ptsColor(points) }}>
        {points} pts
      </span>
    </div>
  );
}

interface EpisodeBD {
  episodeNumber: number;
  totalDelta: number;
  trioDelta: number;
  ickyDelta: number;
  prophecyDelta: number;
  trioBreakdowns: { castawayId: number; points: number; details: { label: string; points: number }[] }[];
  ickyInfo: { name: string; placement: string | null } | null;
  prophecyInfo: { correctCount: number; totalResolved: number } | null;
}

function EpisodeRow({ episode, castawayMap }: { episode: EpisodeBD; castawayMap: Map<number, any> }) {
  const [expanded, setExpanded] = useState(false);
  const tribeColors = useTribeColors();

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Episode {episode.episodeNumber}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: ptsColor(episode.totalDelta) }}>
            {pts(episode.totalDelta)} pts
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 py-3 space-y-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {/* Trio breakdown */}
          {episode.trioBreakdowns.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                  Trusted Trio
                </span>
                <span className="text-xs font-bold" style={{ color: ptsColor(episode.trioDelta) }}>
                  {pts(episode.trioDelta)}
                </span>
              </div>
              {episode.trioBreakdowns.map(({ castawayId, points, details }) => {
                const castaway = castawayMap.get(castawayId);
                const tribeColor = tribeColors[castaway?.original_tribe ?? ""] ?? "#8E8E93";
                return (
                  <div key={castawayId} className="ml-2 mb-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tribeColor }} />
                      <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-text)" }}>
                        {castaway?.name ?? "?"}
                      </span>
                      <span className="text-sm font-bold" style={{ color: ptsColor(points) }}>
                        {pts(points)}
                      </span>
                    </div>
                    {details.map((d, i) => (
                      <div key={i} className="flex justify-between items-center pl-4">
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{d.label}</span>
                        <span className="text-xs font-semibold" style={{ color: ptsColor(d.points) }}>
                          {pts(d.points)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Icky pick */}
          {episode.ickyInfo && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                  Icky Pick
                </span>
                <span className="text-xs font-bold" style={{ color: ptsColor(episode.ickyDelta) }}>
                  {pts(episode.ickyDelta)}
                </span>
              </div>
              <div className="flex justify-between items-center ml-2">
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {episode.ickyInfo.name}
                  {episode.ickyInfo.placement
                    ? ` — ${ICKY_PLACEMENT_LABELS[episode.ickyInfo.placement] ?? episode.ickyInfo.placement}`
                    : ""}
                </span>
                <span className="text-xs font-semibold" style={{ color: ptsColor(episode.ickyDelta) }}>
                  {pts(episode.ickyDelta)}
                </span>
              </div>
            </div>
          )}

          {/* Prophecy */}
          {episode.prophecyInfo && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                  Prophecy
                </span>
                <span className="text-xs font-bold" style={{ color: ptsColor(episode.prophecyDelta) }}>
                  {pts(episode.prophecyDelta)}
                </span>
              </div>
              {episode.prophecyInfo.totalResolved > 0 && (
                <div className="flex justify-between items-center ml-2">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {episode.prophecyInfo.correctCount} of {episode.prophecyInfo.totalResolved} resolved correct
                  </span>
                  <span className="text-xs font-semibold" style={{ color: ptsColor(episode.prophecyDelta) }}>
                    {pts(episode.prophecyDelta)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const castawayMap = useCastawayMap();
  const tribeColors = useTribeColors();
  const activeGroup = useAuthStore((s) => s.activeGroup);
  const viewerProfile = useAuthStore((s) => s.profile);
  const { config } = useSeasonConfig();
  const { maxSeenEpisode, isLoading: seenLoading } = useEpisodeSeenStatus();
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const spoilerEnabled = viewerProfile?.spoiler_protection ?? true;
  const currentEpisode = config?.current_episode ?? 0;
  const needsSnapshot = spoilerEnabled && maxSeenEpisode < currentEpisode && currentEpisode > 0;
  const groupId = activeGroup?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["player-detail", id, groupId, needsSnapshot ? maxSeenEpisode : "live"],
    queryFn: async () => {
      const supabase = createClient();
      const [profileRes, picksRes, answersRes, outcomesRes, scoresRes, trioDetailRes, snapshotsRes] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", id).single(),
          supabase.from("picks").select("*").eq("player_id", id).maybeSingle(),
          supabase.from("prophecy_answers").select("*").eq("player_id", id),
          supabase.from("prophecy_outcomes").select("*"),
          groupId
            ? needsSnapshot
              ? supabase
                  .from("score_snapshots")
                  .select("*")
                  .eq("player_id", id)
                  .eq("group_id", groupId)
                  .eq("episode_number", maxSeenEpisode)
                  .maybeSingle()
              : supabase.from("score_cache").select("*").eq("player_id", id).eq("group_id", groupId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          groupId && !needsSnapshot
            ? supabase.from("score_cache_trio_detail").select("*").eq("player_id", id).eq("group_id", groupId)
            : Promise.resolve({ data: [], error: null }),
          groupId
            ? supabase
                .from("score_snapshots")
                .select("*")
                .eq("player_id", id)
                .eq("group_id", groupId)
                .order("episode_number", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        ]);

      const picks = picksRes.data as Picks | null;
      let trioEvents: (CastawayEvent & { episodes: { episode_number: number } })[] = [];
      if (picks) {
        const trioIds = [picks.trio_castaway_1, picks.trio_castaway_2, picks.trio_castaway_3];
        const { data: evtData } = await supabase
          .from("castaway_events")
          .select("*, episodes(episode_number)")
          .in("castaway_id", trioIds)
          .order("episodes(episode_number)", { ascending: true });
        trioEvents = (evtData ?? []) as (CastawayEvent & { episodes: { episode_number: number } })[];
      }

      return {
        profile: profileRes.data as Profile,
        picks,
        prophecyAnswers: (answersRes.data ?? []) as ProphecyAnswer[],
        prophecyOutcomes: (outcomesRes.data ?? []) as ProphecyOutcome[],
        scores: scoresRes.data as ScoreCache | null,
        trioDetail: (trioDetailRes.data ?? []) as ScoreCacheTrioDetail[],
        trioEvents,
        snapshots: (snapshotsRes.data ?? []) as ScoreSnapshot[],
      };
    },
    enabled: !!id && !seenLoading,
  });

  const episodeBreakdown = useMemo((): EpisodeBD[] => {
    const snapshots = data?.snapshots ?? [];
    const trioEvts = data?.trioEvents ?? [];
    const prophecyOuts = data?.prophecyOutcomes ?? [];
    const prophecyAns = data?.prophecyAnswers ?? [];
    const picks = data?.picks;
    if (snapshots.length === 0 && trioEvts.length === 0) return [];

    const deltas = snapshots.map((snap, i) => {
      const prev = i > 0 ? snapshots[i - 1] : { trio_points: 0, icky_points: 0, prophecy_points: 0, total_points: 0 };
      return {
        episodeNumber: snap.episode_number,
        trioDelta: snap.trio_points - prev.trio_points,
        ickyDelta: snap.icky_points - prev.icky_points,
        prophecyDelta: snap.prophecy_points - prev.prophecy_points,
        totalDelta: snap.total_points - prev.total_points,
      };
    });

    type TrioEvt = (typeof trioEvts)[number];
    const trioByEpisode = new Map<number, TrioEvt[]>();
    for (const event of trioEvts) {
      const epNum = event.episodes?.episode_number ?? 0;
      if (epNum === 0) continue;
      if (!trioByEpisode.has(epNum)) trioByEpisode.set(epNum, []);
      trioByEpisode.get(epNum)!.push(event);
    }

    const pAnswerMap = new Map(prophecyAns.map((a) => [a.question_id, a.answer]));
    const prophecyByEp = new Map<number, { correctCount: number; totalResolved: number }>();
    for (const o of prophecyOuts) {
      if (o.outcome !== null && o.episode_number) {
        if (!prophecyByEp.has(o.episode_number)) prophecyByEp.set(o.episode_number, { correctCount: 0, totalResolved: 0 });
        const entry = prophecyByEp.get(o.episode_number)!;
        entry.totalResolved++;
        if (pAnswerMap.get(o.question_id) === o.outcome) entry.correctCount++;
      }
    }

    const ickyCW = picks ? castawayMap.get(picks.icky_castaway) : null;
    const ickyName = ickyCW?.name ?? "?";
    const ickyPlace = ickyCW?.final_placement ?? null;

    const allEpisodes = new Set<number>();
    deltas.forEach((d) => allEpisodes.add(d.episodeNumber));
    trioByEpisode.forEach((_, ep) => allEpisodes.add(ep));
    const deltaMap = new Map(deltas.map((d) => [d.episodeNumber, d]));

    const result = Array.from(allEpisodes)
      .sort((a, b) => a - b)
      .map((episodeNumber) => {
        const delta = deltaMap.get(episodeNumber);
        const trioEventsForEp = trioByEpisode.get(episodeNumber) ?? [];

        const byCastaway = new Map<number, TrioEvt[]>();
        for (const event of trioEventsForEp) {
          if (!byCastaway.has(event.castaway_id)) byCastaway.set(event.castaway_id, []);
          byCastaway.get(event.castaway_id)!.push(event);
        }
        const trioBreakdowns = Array.from(byCastaway.entries()).map(([castawayId, evts]) => {
          let evtPts = 0;
          const details: { label: string; points: number }[] = [];
          for (const e of evts) {
            if (e.event_type === "survived_episode") {
              const sp = getSurvivalPoints(episodeNumber);
              evtPts += sp;
              details.push({ label: "Survived", points: sp });
            } else {
              const ep = EVENT_SCORES[e.event_type as EventType] ?? 0;
              evtPts += ep;
              details.push({ label: EVENT_LABELS[e.event_type as EventType] ?? e.event_type, points: ep });
            }
          }
          return { castawayId, points: evtPts, details };
        });

        const trioDelta = delta?.trioDelta ?? trioBreakdowns.reduce((sum, c) => sum + c.points, 0);
        const ickyDelta = delta?.ickyDelta ?? 0;
        const prophecyDelta = delta?.prophecyDelta ?? 0;
        const totalDelta = delta?.totalDelta ?? trioDelta + ickyDelta + prophecyDelta;
        const pInfo = prophecyByEp.get(episodeNumber) ?? null;

        return {
          episodeNumber,
          totalDelta,
          trioDelta,
          ickyDelta,
          prophecyDelta,
          trioBreakdowns,
          ickyInfo: ickyDelta !== 0 ? { name: ickyName, placement: ickyPlace } : null,
          prophecyInfo: prophecyDelta !== 0 ? (pInfo ?? { correctCount: 0, totalResolved: 0 }) : null,
        };
      })
      .filter((ep) => ep.totalDelta !== 0 || ep.trioBreakdowns.length > 0);

    if (needsSnapshot) return result.filter((ep) => ep.episodeNumber <= maxSeenEpisode);
    return result;
  }, [data, castawayMap, needsSnapshot, maxSeenEpisode]);

  if (isLoading || seenLoading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <p className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>
          Player not found.
        </p>
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  if (!data.picks) {
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <p className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>
          No picks submitted yet.
        </p>
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  const { profile, picks, prophecyAnswers, prophecyOutcomes, scores, trioDetail } = data;
  const trio = [picks.trio_castaway_1, picks.trio_castaway_2, picks.trio_castaway_3] as const;
  const answersMap = new Map(prophecyAnswers.map((a) => [a.question_id, a.answer]));
  const outcomesMap = new Map(
    prophecyOutcomes
      .filter((o) => {
        if (needsSnapshot && o.episode_number !== null) return o.episode_number <= maxSeenEpisode;
        return true;
      })
      .map((o) => [o.question_id, o.outcome])
  );
  const trioDetailMap = new Map(trioDetail.map((d) => [d.castaway_id, d.points_earned]));
  const trioPoints = scores?.trio_points ?? 0;
  const ickyPoints = scores?.icky_points ?? 0;
  const prophecyPoints = scores?.prophecy_points ?? 0;
  const totalPoints = scores?.total_points ?? 0;

  const initials = getInitials(profile.display_name ?? "?");
  const hasUnseenEpisodes = spoilerEnabled && maxSeenEpisode < currentEpisode && currentEpisode > 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Player header */}
      <div
        className="flex flex-col items-center py-6 rounded-xl"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-16 h-16 rounded-full object-cover mb-3"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3"
            style={{ backgroundColor: getAvatarColor(profile.display_name ?? "?") }}
          >
            {initials}
          </div>
        )}
        <div className="text-2xl font-black" style={{ color: "var(--color-text)" }}>
          {profile.display_name}
        </div>
        <div className="text-xl font-black mt-1" style={{ color: "var(--color-primary)" }}>
          {totalPoints} pts
        </div>
      </div>

      {/* Score pills */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Trio", value: trioPoints },
          { label: "Icky", value: ickyPoints },
          { label: "Prophecy", value: prophecyPoints },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center py-3 rounded-xl"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <span className="text-xl font-black" style={{ color: value < 0 ? "var(--color-error)" : "var(--color-text)" }}>
              {value}
            </span>
            <span className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Spoiler banner */}
      {hasUnseenEpisodes && (
        <div
          className="px-4 py-3 rounded-xl text-sm border"
          style={{ backgroundColor: "rgba(196,64,47,0.06)", borderColor: "rgba(196,64,47,0.2)" }}
        >
          <span className="font-semibold" style={{ color: "var(--color-primary)" }}>
            Spoiler protection on
          </span>
          <span style={{ color: "var(--color-text-secondary)" }}>
            {" — showing scores through Episode "}
            {maxSeenEpisode > 0 ? maxSeenEpisode : "pre-season"}.
          </span>
        </div>
      )}

      {/* Episode Breakdown (collapsible) */}
      {episodeBreakdown.length > 0 && (
        <div>
          <button
            onClick={() => setBreakdownOpen(!breakdownOpen)}
            className="w-full flex items-center justify-between px-1 mb-2"
          >
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-text-secondary)" }}>
                Score Breakdown
              </h2>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {breakdownOpen ? "▲" : "▼"}
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: ptsColor(totalPoints) }}>
              {totalPoints} pts
            </span>
          </button>
          {breakdownOpen && (
            <div className="space-y-1.5">
              {episodeBreakdown.map((ep) => (
                <EpisodeRow key={ep.episodeNumber} episode={ep} castawayMap={castawayMap} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trusted Trio */}
      <div>
        <SectionHeader title="Trusted Trio" points={trioPoints} />
        <div className="space-y-2">
          {trio.map((castawayId) => {
            const castaway = castawayMap.get(castawayId);
            const tribeColor = tribeColors[castaway?.original_tribe ?? ""] ?? "#8E8E93";
            const castawayPts = needsSnapshot ? null : (trioDetailMap.get(castawayId) ?? 0);
            return (
              <Link
                key={castawayId}
                href={`/castaways/${castawayId}`}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderLeft: `4px solid ${tribeColor}`,
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${!needsSnapshot && !castaway?.is_active ? "line-through opacity-60" : ""}`}
                      style={{ color: "var(--color-text)" }}
                    >
                      {castaway?.name ?? "?"}
                    </span>
                    {!needsSnapshot && !castaway?.is_active && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--color-error)", backgroundColor: "rgba(255,59,48,0.1)" }}>
                        OUT
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5 font-semibold" style={{ color: tribeColor }}>
                    {castaway?.original_tribe}
                  </div>
                </div>
                {castawayPts !== null ? (
                  <span className="text-sm font-bold" style={{ color: ptsColor(castawayPts) }}>
                    {castawayPts > 0 ? `+${castawayPts}` : castawayPts} pts
                  </span>
                ) : (
                  <span style={{ color: "var(--color-text-muted)" }}>—</span>
                )}
                <span className="text-lg" style={{ color: "var(--color-text-muted)" }}>›</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Icky Pick */}
      <div>
        <SectionHeader title="Icky Pick" points={ickyPoints} />
        {(() => {
          const castaway = castawayMap.get(picks.icky_castaway);
          const tribeColor = tribeColors[castaway?.original_tribe ?? ""] ?? "#8E8E93";
          return (
            <Link
              href={`/castaways/${picks.icky_castaway}`}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderLeft: `4px solid ${tribeColor}`,
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${!needsSnapshot && !castaway?.is_active ? "line-through opacity-60" : ""}`}
                    style={{ color: "var(--color-text)" }}
                  >
                    {castaway?.name ?? "?"}
                  </span>
                  {!needsSnapshot && !castaway?.is_active && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--color-error)", backgroundColor: "rgba(255,59,48,0.1)" }}>
                      OUT
                    </span>
                  )}
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--color-error)", backgroundColor: "rgba(255,59,48,0.08)" }}>
                    Icky Pick
                  </span>
                </div>
                <div className="text-xs mt-0.5 font-semibold" style={{ color: tribeColor }}>
                  {castaway?.original_tribe}
                </div>
              </div>
              <span className="text-sm font-bold" style={{ color: ptsColor(ickyPoints) }}>
                {ickyPoints > 0 ? `+${ickyPoints}` : ickyPoints} pts
              </span>
              <span className="text-lg" style={{ color: "var(--color-text-muted)" }}>›</span>
            </Link>
          );
        })()}
      </div>

      {/* Prophecy Picks */}
      <div>
        <SectionHeader title="Prophecy Picks" points={prophecyPoints} />
        <div className="space-y-2">
          {PROPHECY_QUESTIONS.map((q) => {
            const answer = answersMap.get(q.id);
            const outcome = outcomesMap.get(q.id);
            const isResolved = outcome !== null && outcome !== undefined;
            const isCorrect = isResolved && answer === outcome;

            return (
              <div
                key={q.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border"
                style={{
                  backgroundColor: isResolved
                    ? isCorrect ? "rgba(52,199,89,0.06)" : "rgba(255,59,48,0.04)"
                    : "var(--color-surface)",
                  borderColor: isResolved
                    ? isCorrect ? "rgba(52,199,89,0.3)" : "rgba(255,59,48,0.2)"
                    : "var(--color-border)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${isResolved && !isCorrect ? "opacity-60" : ""}`}
                    style={{ color: "var(--color-text)" }}
                  >
                    {q.text}
                  </p>
                  {isResolved && (
                    <p
                      className="text-xs font-semibold mt-0.5"
                      style={{ color: isCorrect ? "var(--color-success)" : "var(--color-error)" }}
                    >
                      {isCorrect ? `+${q.points}pt` : "+0pt"}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        answer === undefined ? "rgba(142,142,147,0.1)"
                        : answer ? "rgba(52,199,89,0.12)"
                        : "rgba(255,59,48,0.1)",
                      color:
                        answer === undefined ? "var(--color-text-muted)"
                        : answer ? "var(--color-success)"
                        : "var(--color-error)",
                    }}
                  >
                    {answer === undefined ? "—" : answer ? "YES" : "NO"}
                  </span>
                  {isResolved ? (
                    <span
                      className="text-sm font-bold"
                      style={{ color: isCorrect ? "var(--color-success)" : "var(--color-error)" }}
                    >
                      {isCorrect ? "✓" : "✗"}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {q.points}pt
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
