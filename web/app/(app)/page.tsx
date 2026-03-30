"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useSeasonConfig } from "@/hooks/useSeasonConfig";
import { useEpisodeSeenStatus } from "@/hooks/useEpisodeSeenStatus";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import type { PlayerScore, Group } from "@shared/types";

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
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

type RankedEntry = PlayerScore & { rank: number; is_tied: boolean };

function LeaderboardRow({
  entry,
  picksRevealed,
}: {
  entry: RankedEntry;
  picksRevealed: boolean;
}) {
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
        {entry.rank}
        {entry.is_tied ? "T" : ""}
      </div>

      {entry.avatar_url ? (
        <img
          src={entry.avatar_url}
          alt={entry.display_name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
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
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            {entry.trio_points}
          </span>
          <span style={{ color: "var(--color-text-muted)" }}> Trio</span>
          <span className="mx-1.5" style={{ color: "var(--color-text-muted)" }}>·</span>
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            {entry.icky_points}
          </span>
          <span style={{ color: "var(--color-text-muted)" }}> Icky</span>
          <span className="mx-1.5" style={{ color: "var(--color-text-muted)" }}>·</span>
          <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            {entry.prophecy_points}
          </span>
          <span style={{ color: "var(--color-text-muted)" }}> Proph</span>
        </div>
      </div>

      <span
        className="text-xl font-black min-w-[2.5rem] text-right"
        style={{ color: rankColor ?? "var(--color-primary)" }}
      >
        {entry.total_points}
      </span>

      {picksRevealed && (
        <span className="text-lg" style={{ color: "var(--color-text-muted)" }}>
          ›
        </span>
      )}
    </div>
  );

  if (picksRevealed) {
    return (
      <Link
        href={`/player/${entry.player_id}`}
        className="block hover:opacity-80 transition-opacity"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function LeaderboardPage() {
  const activeGroup = useAuthStore((s) => s.activeGroup);
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const setActiveGroup = useAuthStore((s) => s.setActiveGroup);
  const queryClient = useQueryClient();

  const [showGroupPicker, setShowGroupPicker] = useState(false);
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
  const { maxSeenEpisode, isLoading: seenLoading } = useEpisodeSeenStatus();

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
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
          No Group Selected
        </h2>
        <p
          className="text-sm text-center max-w-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Join or create a group to see the leaderboard.
        </p>
        <Link
          href="/groups/join"
          className="px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Join a Group
        </Link>
        <Link
          href="/groups/create"
          className="px-6 py-3 rounded-xl text-sm font-semibold border"
          style={{
            color: "var(--color-text-secondary)",
            borderColor: "var(--color-border)",
          }}
        >
          Create a Group
        </Link>
      </div>
    );
  }

  const hasUnseenEpisodes =
    spoilerEnabled && maxSeenEpisode < currentEpisode && currentEpisode > 0;

  return (
    <div className="space-y-4">
      {/* Episode banner */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl border"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {displayedEpisode
              ? `Standings Through Episode ${displayedEpisode}`
              : "Pre-Season Standings"}
          </div>
          {!picksRevealed && (
            <div
              className="text-xs italic mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Picks hidden until reveal
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          {/* Group switcher */}
          <div ref={pickerRef} className="relative">
            <button
              onClick={() => setShowGroupPicker((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1 transition-colors"
              style={{
                color: "var(--color-text-secondary)",
                backgroundColor: showGroupPicker ? "var(--color-border)" : "transparent",
              }}
            >
              {activeGroup.name}
              {groups.length > 1 && (
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.6rem" }}>
                  {showGroupPicker ? "▴" : "▾"}
                </span>
              )}
            </button>
            {showGroupPicker && groups.length > 1 && (
              <div
                className="absolute right-0 top-full mt-1 min-w-[140px] rounded-xl border shadow-lg z-20 overflow-hidden"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSwitchGroup(g)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left text-xs font-semibold hover:opacity-70 transition-opacity border-b last:border-b-0"
                    style={{
                      color: g.id === activeGroup.id ? "var(--color-primary)" : "var(--color-text)",
                      borderColor: "var(--color-border)",
                      backgroundColor:
                        g.id === activeGroup.id ? "rgba(196,64,47,0.06)" : "transparent",
                    }}
                  >
                    {g.name}
                    {g.id === activeGroup.id && (
                      <span style={{ color: "var(--color-primary)" }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/players/gallery"
            className="text-xs font-bold flex items-center gap-0.5"
            style={{ color: "var(--color-primary)" }}
          >
            Player Bios <span>›</span>
          </Link>
        </div>
      </div>

      {/* Spoiler protection banner */}
      {hasUnseenEpisodes && (
        <div
          className="px-4 py-3 rounded-xl text-sm border"
          style={{
            backgroundColor: "rgba(196,64,47,0.06)",
            borderColor: "rgba(196,64,47,0.2)",
          }}
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

      {/* Leaderboard list */}
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <LeaderboardRow
            key={entry.player_id}
            entry={entry as RankedEntry}
            picksRevealed={picksRevealed}
          />
        ))}
        {entries.length === 0 && (
          <p
            className="text-center py-10 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            No scores yet.
          </p>
        )}
      </div>
    </div>
  );
}
