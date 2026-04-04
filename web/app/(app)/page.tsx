"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useSeasonConfig } from "@/hooks/useSeasonConfig";
import { useEpisodeSeenStatus } from "@/hooks/useEpisodeSeenStatus";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { PageHeading } from "@/components/PageHeading";
import { PROPHECY_QUESTIONS } from "@shared/lib/constants";
import type { PlayerScore, Group } from "@shared/types";

// ─── Constants & helpers ──────────────────────────────────────────────────────

const RANK_COLORS: Record<number, string> = {
  1: "#D4A017",
  2: "#8A8A8A",
  3: "#B87333",
};

const AVATAR_COLORS = [
  "#C4402F", "#2E7D32", "#1565C0", "#F57F17",
  "#7B1FA2", "#00838F", "#D84315", "#4527A0",
  "#00695C", "#AD1457", "#1B5E20", "#0D47A1",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

type LeaderboardTab = "recaps" | "prophecy" | "scoring";

const DEPARTURE_EVENT_TYPES = new Set([
  "quit", "voted_out_unanimously", "voted_out_with_idol", "voted_out_with_advantage", "first_boot",
]);

const NOTABLE_EVENT_LABELS: Record<string, string> = {
  individual_immunity_win: "Immunity",
  individual_reward_win: "Reward",
  idol_found: "Found Idol",
  advantage_found: "Found Advantage",
  idol_played_correct: "Played Idol (Correct)",
  idol_played_incorrect: "Played Idol (Incorrect)",
  shot_in_dark_success: "Shot in Dark — Safe",
  shot_in_dark_fail: "Shot in Dark — Unsafe",
  fire_making_win: "Fire Making Win",
  final_immunity_win: "Final Immunity",
  made_jury: "Made Jury",
  placed_3rd: "3rd Place",
  placed_runner_up: "Runner-Up",
  sole_survivor: "Sole Survivor",
};

// ─── LeaderboardRow ────────────────────────────────────────────────────────────

type RankedEntry = PlayerScore & { rank: number; is_tied: boolean };

function LeaderboardRow({ entry, picksRevealed }: { entry: RankedEntry; picksRevealed: boolean }) {
  const rankColor = RANK_COLORS[entry.rank];
  const initials = getInitials(entry.display_name ?? "?");

  const inner = (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div
        className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm flex-shrink-0"
        style={{
          backgroundColor: rankColor ? rankColor + "18" : "transparent",
          color: rankColor ?? "var(--color-text-secondary)",
        }}
      >
        {entry.rank}{entry.is_tied ? "T" : ""}
      </div>

      {entry.avatar_url ? (
        <img src={entry.avatar_url} alt={entry.display_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
          style={{ backgroundColor: getAvatarColor(entry.display_name) }}
        >
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
          {entry.display_name}
        </div>
        <div className="text-xs mt-0.5">
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>{entry.trio_points}</span>
          <span style={{ color: "var(--color-text-muted)" }}> Trio</span>
          <span className="mx-1.5" style={{ color: "var(--color-text-muted)" }}>·</span>
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>{entry.icky_points}</span>
          <span style={{ color: "var(--color-text-muted)" }}> Icky</span>
          <span className="mx-1.5" style={{ color: "var(--color-text-muted)" }}>·</span>
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>{entry.prophecy_points}</span>
          <span style={{ color: "var(--color-text-muted)" }}> Proph</span>
        </div>
      </div>

      <span className="text-xl font-black min-w-[2.5rem] text-right" style={{ color: rankColor ?? "var(--color-primary)" }}>
        {entry.total_points}
      </span>

      {picksRevealed && <span className="text-lg" style={{ color: "var(--color-text-muted)" }}>›</span>}
    </div>
  );

  if (picksRevealed) {
    return (
      <Link href={`/player/${entry.player_id}`} className="block hover:opacity-80 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ─── EpisodeRecapsTab ──────────────────────────────────────────────────────────

interface EpisodeWithEvents {
  id: number;
  episode_number: number;
  is_merge: boolean;
  is_finale: boolean;
  castaway_events: { event_type: string; castaways: { id: number; name: string } | null }[];
}

function EpisodeRecapsTab({ session }: { session: any }) {
  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ["episode-recaps"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("episodes")
        .select("id, episode_number, is_merge, is_finale, castaway_events(event_type, castaways(id, name))")
        .eq("is_finalized", true)
        .order("episode_number", { ascending: false });
      return (data ?? []) as EpisodeWithEvents[];
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <Spinner />;

  if (episodes.length === 0) {
    return (
      <p className="text-center py-10 text-sm" style={{ color: "var(--color-text-muted)" }}>
        No episodes logged yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {episodes.map((ep) => {
        const survivedIds = new Set(
          ep.castaway_events
            .filter((e) => e.event_type === "survived_episode")
            .map((e) => e.castaways?.id)
            .filter(Boolean)
        );

        // Departed = appeared in events but not in survived set
        const allCastawayIds = new Map<number, string>();
        ep.castaway_events.forEach((e) => {
          if (e.castaways) allCastawayIds.set(e.castaways.id, e.castaways.name);
        });

        const departed: string[] = [];
        allCastawayIds.forEach((name, id) => {
          if (!survivedIds.has(id)) departed.push(name);
        });

        // Notable events per castaway (exclude survived/departure detail events)
        const notableByPerson: Record<string, string[]> = {};
        ep.castaway_events
          .filter((e) => NOTABLE_EVENT_LABELS[e.event_type] && e.castaways)
          .forEach((e) => {
            const name = e.castaways!.name;
            if (!notableByPerson[name]) notableByPerson[name] = [];
            notableByPerson[name].push(NOTABLE_EVENT_LABELS[e.event_type]);
          });

        // Departure details per departed castaway
        const departureDetails: Record<string, string[]> = {};
        ep.castaway_events
          .filter((e) => DEPARTURE_EVENT_TYPES.has(e.event_type) && e.castaways)
          .forEach((e) => {
            const name = e.castaways!.name;
            if (!departureDetails[name]) departureDetails[name] = [];
            const label =
              e.event_type === "quit" ? "Quit" :
              e.event_type === "voted_out_unanimously" ? "Unanimous" :
              e.event_type === "voted_out_with_idol" ? "Had Idol" :
              e.event_type === "voted_out_with_advantage" ? "Had Advantage" :
              e.event_type === "first_boot" ? "First Boot" : "";
            if (label) departureDetails[name].push(label);
          });

        return (
          <div
            key={ep.id}
            className="rounded-xl border px-4 py-3 space-y-2"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                Episode {ep.episode_number}
              </span>
              {ep.is_merge && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(196,64,47,0.12)", color: "var(--color-primary)" }}>
                  Merge
                </span>
              )}
              {ep.is_finale && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(212,160,23,0.15)", color: "#D4A017" }}>
                  Finale
                </span>
              )}
              </div>
              <Link
                href={`/episodes/${ep.id}`}
                className="text-xs font-semibold flex-shrink-0"
                style={{ color: "var(--color-primary)" }}
              >
                Full recap ›
              </Link>
            </div>

            {/* Departed */}
            {departed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {departed.map((name) => (
                  <div key={name} className="flex items-center gap-1">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: "rgba(196,64,47,0.1)", color: "var(--color-primary)" }}
                    >
                      {name} out
                      {departureDetails[name]?.length > 0 && (
                        <span style={{ color: "rgba(196,64,47,0.7)" }}>
                          {" "}· {departureDetails[name].join(", ")}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Notable events */}
            {Object.keys(notableByPerson).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(notableByPerson).map(([name, events]) => (
                  <span
                    key={name}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ backgroundColor: "var(--color-background)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
                  >
                    <span className="font-semibold">{name}</span>: {events.join(", ")}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ProphecyPicksTab ──────────────────────────────────────────────────────────

function ProphecyPicksTab({ activeGroupId, session }: { activeGroupId: string; session: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["group-prophecy-picks", activeGroupId],
    queryFn: async () => {
      const supabase = createClient();
      const [membersResult, outcomesResult] = await Promise.all([
        supabase
          .from("group_members")
          .select("user_id, profiles(display_name, avatar_url)")
          .eq("group_id", activeGroupId),
        supabase.from("prophecy_outcomes").select("question_id, outcome"),
      ]);

      const members = (membersResult.data ?? []) as {
        user_id: string;
        profiles: { display_name: string; avatar_url: string | null } | null;
      }[];
      const memberIds = members.map((m) => m.user_id);

      const answersResult = await supabase
        .from("prophecy_answers")
        .select("player_id, question_id, answer")
        .in("player_id", memberIds);

      return {
        members: members
          .map((m) => ({
            id: m.user_id,
            name: m.profiles?.display_name ?? "?",
            avatarUrl: m.profiles?.avatar_url ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        answers: (answersResult.data ?? []) as { player_id: string; question_id: number; answer: boolean }[],
        outcomes: (outcomesResult.data ?? []) as { question_id: number; outcome: boolean | null }[],
      };
    },
    enabled: !!activeGroupId && !!session,
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading) return <Spinner />;

  const members = data?.members ?? [];
  const answers = data?.answers ?? [];
  const outcomes = data?.outcomes ?? [];

  const answerMap = new Map<string, boolean>();
  answers.forEach((a) => answerMap.set(`${a.player_id}_${a.question_id}`, a.answer));

  const outcomeMap = new Map<number, boolean | null>();
  outcomes.forEach((o) => outcomeMap.set(o.question_id, o.outcome));

  // Column widths: question column is fixed, each player column is 36px
  const COL = 36; // px per player column

  return (
    // -mx-4 px-4 lets the scroll area go edge-to-edge on mobile
    <div className="-mx-4 overflow-x-auto">
      <div style={{ minWidth: `${220 + members.length * COL}px` }} className="px-4">

        {/* Header: sticky question label + player avatar circles */}
        <div
          className="flex items-end gap-0 mb-1 px-3 py-2 rounded-xl"
          style={{ backgroundColor: "var(--color-surface)" }}
        >
          {/* Question column header */}
          <div
            className="text-xs font-bold uppercase tracking-wider flex-shrink-0"
            style={{ width: 200, color: "var(--color-text-muted)" }}
          >
            Question
          </div>
          {/* Player avatar headers */}
          <div className="flex">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-col items-center gap-1 flex-shrink-0"
                style={{ width: COL }}
                title={m.name}
              >
                {m.avatarUrl ? (
                  <img
                    src={m.avatarUrl}
                    alt={m.name}
                    className="rounded-full object-cover"
                    style={{ width: 26, height: 26 }}
                  />
                ) : (
                  <div
                    className="rounded-full flex items-center justify-center text-white font-bold"
                    style={{
                      width: 26, height: 26,
                      fontSize: 9,
                      backgroundColor: getAvatarColor(m.name),
                    }}
                  >
                    {getInitials(m.name)}
                  </div>
                )}
                <span
                  className="text-center leading-tight font-semibold"
                  style={{
                    fontSize: 8,
                    color: "var(--color-text-muted)",
                    width: COL - 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                >
                  {m.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Question rows */}
        {PROPHECY_QUESTIONS.map((q) => {
          const outcome = outcomeMap.get(q.id);
          return (
            <div
              key={q.id}
              className="flex items-center gap-0 px-3 py-2.5 rounded-xl border mb-1.5"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              {/* Question text + points + outcome */}
              <div className="flex-shrink-0 pr-2" style={{ width: 200 }}>
                <div className="text-xs leading-snug" style={{ color: "var(--color-text)" }}>
                  {q.text}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{q.points}pt</span>
                  <OutcomePill outcome={outcome ?? null} />
                </div>
              </div>

              {/* Y / N cells */}
              <div className="flex items-center">
                {members.map((m) => {
                  const answer = answerMap.get(`${m.id}_${q.id}`);
                  if (answer === undefined) {
                    return (
                      <div
                        key={m.id}
                        className="rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          width: 24, height: 24,
                          marginLeft: (COL - 24) / 2,
                          marginRight: (COL - 24) / 2,
                          fontSize: 9,
                          backgroundColor: "var(--color-background)",
                          border: "1px dashed var(--color-border)",
                          color: "var(--color-text-muted)",
                        }}
                        title={`${m.name}: no answer`}
                      >
                        –
                      </div>
                    );
                  }
                  const isCorrect = outcome != null && answer === outcome;
                  const isWrong = outcome != null && answer !== outcome;
                  return (
                    <div
                      key={m.id}
                      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
                      style={{
                        width: 24, height: 24,
                        marginLeft: (COL - 24) / 2,
                        marginRight: (COL - 24) / 2,
                        fontSize: 9,
                        backgroundColor: isCorrect
                          ? "rgba(34,197,94,0.2)"
                          : isWrong
                          ? "rgba(196,64,47,0.15)"
                          : answer
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(196,64,47,0.1)",
                        color: isCorrect
                          ? "#16a34a"
                          : isWrong
                          ? "var(--color-primary)"
                          : answer
                          ? "#22c55e"
                          : "var(--color-primary)",
                        border: `1px solid ${isCorrect ? "rgba(34,197,94,0.3)" : isWrong ? "rgba(196,64,47,0.3)" : answer ? "rgba(34,197,94,0.2)" : "rgba(196,64,47,0.2)"}`,
                      }}
                      title={`${m.name}: ${answer ? "Yes" : "No"}`}
                    >
                      {answer ? "Y" : "N"}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutcomePill({ outcome }: { outcome: boolean | null }) {
  if (outcome === null || outcome === undefined) {
    return <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: "var(--color-background)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>Pending</span>;
  }
  if (outcome === true) {
    return <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)" }}>YES</span>;
  }
  return <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: "rgba(196,64,47,0.1)", color: "var(--color-primary)", border: "1px solid rgba(196,64,47,0.3)" }}>NO</span>;
}

// ─── ScoringTab ────────────────────────────────────────────────────────────────

const TRIO_EVENTS = [
  { label: "Found Idol", pts: "+5" },
  { label: "Found Advantage", pts: "+4" },
  { label: "Played Idol (Correct)", pts: "+8" },
  { label: "Played Idol (Incorrect)", pts: "−3" },
  { label: "Shot in Dark — Success", pts: "+6" },
  { label: "Shot in Dark — Fail", pts: "−5" },
  { label: "Won Individual Immunity", pts: "+6" },
  { label: "Won Individual Reward", pts: "+3" },
  { label: "Won Fire Making", pts: "+10" },
  { label: "Won Final Immunity", pts: "+12" },
  { label: "Made Jury", pts: "+5" },
  { label: "3rd Place", pts: "+20" },
  { label: "Runner-Up", pts: "+25" },
  { label: "Sole Survivor", pts: "+40" },
  { label: "First Boot", pts: "−25" },
  { label: "Voted Out w/ Idol", pts: "−12" },
  { label: "Voted Out w/ Advantage", pts: "−10" },
  { label: "Voted Out Unanimously", pts: "−5" },
  { label: "Quit", pts: "−25" },
];

const SURVIVAL_TIERS = [
  { range: "Eps 1–3", pts: "1 pt/ep" },
  { range: "Eps 4–6", pts: "2 pts/ep" },
  { range: "Eps 7–9", pts: "3 pts/ep" },
  { range: "Eps 10–12", pts: "5 pts/ep" },
  { range: "Final 5", pts: "7 pts/ep" },
  { range: "Final 4", pts: "10 pts/ep" },
];

const ICKY_PLACEMENTS = [
  { label: "First Boot", pts: "+15" },
  { label: "Pre-Merge Boot", pts: "+8" },
  { label: "Jury Member", pts: "−8" },
  { label: "3rd Place", pts: "−15" },
  { label: "Winner", pts: "−25" },
];

function ScoringTab() {
  return (
    <div className="space-y-5 pb-8">
      {/* Trusted Trio */}
      <ScoringSection title="Trusted Trio — Events">
        {TRIO_EVENTS.map((row) => (
          <ScoringRow key={row.label} label={row.label} value={row.pts} positive={row.pts.startsWith("+")} />
        ))}
      </ScoringSection>

      {/* Survival points */}
      <ScoringSection title="Trusted Trio — Survival Points">
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Per episode survived, per castaway in trio.
        </p>
        {SURVIVAL_TIERS.map((row) => (
          <ScoringRow key={row.range} label={row.range} value={row.pts} positive />
        ))}
      </ScoringSection>

      {/* Icky Pick */}
      <ScoringSection title="Icky Pick — Final Placement">
        {ICKY_PLACEMENTS.map((row) => (
          <ScoringRow key={row.label} label={row.label} value={row.pts} positive={row.pts.startsWith("+")} />
        ))}
      </ScoringSection>

      {/* Prophecy */}
      <ScoringSection title="Prophecy Points (correct only)">
        {[
          { label: "Questions 1–3", pts: "1 pt each" },
          { label: "Questions 4–7", pts: "2 pts each" },
          { label: "Questions 8–9", pts: "3 pts each" },
          { label: "Questions 10–16", pts: "4 pts each" },
        ].map((row) => (
          <ScoringRow key={row.label} label={row.label} value={row.pts} positive />
        ))}
      </ScoringSection>

      {/* Tiebreak */}
      <div className="px-4 py-3 rounded-xl border" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-secondary)" }}>
          Tiebreak Order
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Total → Trio → Prophecy → Icky → Alphabetical
        </p>
      </div>
    </div>
  );
}

function ScoringSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
      <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}>
        {title}
      </div>
      <div style={{ backgroundColor: "var(--color-surface)" }}>
        {children}
      </div>
    </div>
  );
}

function ScoringRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border)" }}>
      <span className="text-xs" style={{ color: "var(--color-text)" }}>{label}</span>
      <span className="text-xs font-bold" style={{ color: positive ? "var(--color-success, #22c55e)" : "var(--color-error)" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
    </div>
  );
}

// ─── LeaderboardPage ───────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const activeGroup = useAuthStore((s) => s.activeGroup);
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const setActiveGroup = useAuthStore((s) => s.setActiveGroup);
  const queryClient = useQueryClient();

  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<LeaderboardTab | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["my-groups", session?.user.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("group_members")
        .select("groups(*)")
        .eq("user_id", session!.user.id);
      return ((data ?? []).map((r: any) => r.groups).filter(Boolean)) as Group[];
    },
    enabled: !!session?.user.id,
  });

  useEffect(() => {
    if (!showGroupPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowGroupPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGroupPicker]);

  async function handleSwitchGroup(group: Group) {
    if (!profile) return;
    setShowGroupPicker(false);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ active_group_id: group.id, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    setActiveGroup(group);
    queryClient.invalidateQueries();
  }

  const { config, isLoading: configLoading } = useSeasonConfig();
  const { maxSeenEpisode, isLoading: seenLoading, isMarking, markAllSeenThrough } = useEpisodeSeenStatus();

  const spoilerEnabled = profile?.spoiler_protection ?? true;
  const currentEpisode = config?.current_episode ?? 0;
  const picksRevealed = config?.picks_revealed ?? false;

  const { data, isLoading } = useLeaderboard({
    groupId: activeGroup?.id ?? null,
    currentEpisode,
    picksRevealed,
    spoilerEnabled,
    maxSeenEpisode: spoilerEnabled ? maxSeenEpisode : 0,
  });

  const entries = data?.entries ?? [];
  const displayedEpisode = data?.displayedEpisode ?? 0;

  if (isLoading || configLoading || seenLoading) {
    return <Spinner />;
  }

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>No Group Selected</h2>
        <p className="text-sm text-center max-w-xs" style={{ color: "var(--color-text-secondary)" }}>
          Join or create a group to see the leaderboard.
        </p>
        <Link href="/groups/join" className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "var(--color-primary)" }}>
          Join a Group
        </Link>
        <Link href="/groups/create" className="px-6 py-3 rounded-xl text-sm font-semibold border" style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}>
          Create a Group
        </Link>
      </div>
    );
  }

  const hasUnseenEpisodes = spoilerEnabled && maxSeenEpisode < currentEpisode && currentEpisode > 0;

  const TABS: { id: LeaderboardTab; label: string }[] = [
    { id: "recaps", label: "Episode Recaps" },
    { id: "prophecy", label: "Prophecy Picks" },
    { id: "scoring", label: "Scoring" },
  ];

  return (
    <div className="space-y-3">
      {/* Page heading with group switcher */}
      <PageHeading
        title="Leaderboard"
        right={
          <div ref={pickerRef} className="relative">
            <button
              onClick={() => setShowGroupPicker((v) => !v)}
              className="flex items-center gap-1.5 font-semibold rounded-2xl px-4 py-2 transition-colors text-sm"
              style={{
                color: "var(--color-primary)",
                backgroundColor: "rgba(196,64,47,0.10)",
              }}
            >
              {activeGroup.name}
              {groups.length > 1 && (
                <span style={{ fontSize: "0.65rem" }}>
                  {showGroupPicker ? "▴" : "▾"}
                </span>
              )}
            </button>
            {showGroupPicker && groups.length > 1 && (
              <div
                className="absolute right-0 top-full mt-1 min-w-[160px] rounded-xl border shadow-lg z-20 overflow-hidden"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSwitchGroup(g)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-semibold hover:opacity-70 transition-opacity border-b last:border-b-0"
                    style={{
                      color: g.id === activeGroup.id ? "var(--color-primary)" : "var(--color-text)",
                      borderColor: "var(--color-border)",
                      backgroundColor: g.id === activeGroup.id ? "rgba(196,64,47,0.06)" : "transparent",
                    }}
                  >
                    {g.name}
                    {g.id === activeGroup.id && <span style={{ color: "var(--color-primary)" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      {/* Episode banner */}
      <div
        className="px-4 py-3 rounded-xl border"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {displayedEpisode ? `Standings Thru Episode ${displayedEpisode}` : "Pre-Season Standings"}
        </div>
        {!picksRevealed && (
          <div className="text-xs italic mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Picks hidden until reveal
          </div>
        )}
      </div>

      {/* Player Bios — dedicated row */}
      <Link
        href="/players/gallery"
        className="flex items-center justify-between px-4 py-3 rounded-xl border transition-opacity hover:opacity-75"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">🏝️</span>
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Player Bios
          </span>
        </div>
        <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>›</span>
      </Link>

      {/* Tab buttons */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(isActive ? null : tab.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-colors"
              style={{
                backgroundColor: isActive ? "var(--color-primary)" : "var(--color-surface)",
                color: isActive ? "#fff" : "var(--color-text-secondary)",
                borderColor: isActive ? "var(--color-primary)" : "var(--color-border)",
              }}
            >
              {tab.label}
              {isActive && <span className="text-xs opacity-75 leading-none">✕</span>}
            </button>
          );
        })}
      </div>

      {/* Back to Standings — shown when a tab panel is open */}
      {activeTab && (
        <button
          onClick={() => setActiveTab(null)}
          className="flex items-center gap-1 text-sm font-semibold"
          style={{ color: "var(--color-text-muted)" }}
        >
          ← Back to Standings
        </button>
      )}

      {/* Spoiler protection banner */}
      {hasUnseenEpisodes && !activeTab && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border"
          style={{ backgroundColor: "rgba(196,64,47,0.06)", borderColor: "rgba(196,64,47,0.2)" }}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
              {currentEpisode - maxSeenEpisode === 1
                ? `Episode ${currentEpisode} is available`
                : `${currentEpisode - maxSeenEpisode} new episodes available`}
            </span>
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Showing scores thru Episode {maxSeenEpisode > 0 ? maxSeenEpisode : "Pre-Season"}
            </span>
          </div>
          <button
            onClick={() => markAllSeenThrough(currentEpisode)}
            disabled={isMarking}
            className="flex-shrink-0 px-3.5 py-2 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {isMarking ? "…" : currentEpisode - maxSeenEpisode === 1 ? "I've seen it" : "Catch up"}
          </button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === "recaps" && <EpisodeRecapsTab session={session} />}
      {activeTab === "prophecy" && <ProphecyPicksTab activeGroupId={activeGroup.id} session={session} />}
      {activeTab === "scoring" && <ScoringTab />}

      {/* Leaderboard (shown when no tab active) */}
      {!activeTab && (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <LeaderboardRow key={entry.player_id} entry={entry as RankedEntry} picksRevealed={picksRevealed} />
          ))}
          {entries.length === 0 && (
            <p className="text-center py-10 text-sm" style={{ color: "var(--color-text-muted)" }}>
              No scores yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
