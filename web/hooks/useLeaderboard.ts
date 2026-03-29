import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { PlayerScore, ScoreCache, ScoreSnapshot, Profile, Picks } from "@shared/types";

// Self-contained copy of sortAndRankScores — avoids importing @shared/lib/scoring
// which has a value import of @/lib/constants (webpack can't resolve that cross-directory).
function sortAndRankScores<
  T extends {
    display_name: string;
    total_points: number;
    trio_points: number;
    prophecy_points: number;
    icky_points: number;
  }
>(players: T[]): (T & { rank: number; is_tied: boolean })[] {
  const sorted = [...players].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.trio_points !== a.trio_points) return b.trio_points - a.trio_points;
    if (b.prophecy_points !== a.prophecy_points) return b.prophecy_points - a.prophecy_points;
    if (b.icky_points !== a.icky_points) return b.icky_points - a.icky_points;
    return a.display_name.localeCompare(b.display_name);
  });

  let currentRank = 1;
  return sorted.map((player, index, arr) => {
    const prev = arr[index - 1];
    const next = arr[index + 1];
    const sameScoreAs = (other: typeof player) =>
      other.total_points === player.total_points &&
      other.trio_points === player.trio_points &&
      other.prophecy_points === player.prophecy_points &&
      other.icky_points === player.icky_points;
    const samePrev = prev ? sameScoreAs(prev) : false;
    const sameNext = next ? sameScoreAs(next) : false;
    if (!samePrev) currentRank = index + 1;
    return { ...player, rank: currentRank, is_tied: samePrev || sameNext };
  });
}

interface Options {
  groupId: string | null;
  currentEpisode: number;
  picksRevealed: boolean;
  spoilerEnabled?: boolean;
  maxSeenEpisode?: number;
}

async function fetchLeaderboard(options: Options) {
  const { groupId, currentEpisode, picksRevealed, spoilerEnabled, maxSeenEpisode } = options;
  if (!groupId) return { entries: [], displayedEpisode: 0 };

  const supabase = createClient();
  const needsSnapshot =
    (spoilerEnabled ?? false) &&
    (maxSeenEpisode ?? 0) < currentEpisode &&
    currentEpisode > 0;
  const snapshotEp = maxSeenEpisode ?? 0;

  const [membersRes, scoresRes, profilesRes, picksRes] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
    needsSnapshot
      ? supabase
          .from("score_snapshots")
          .select("*")
          .eq("group_id", groupId)
          .eq("episode_number", snapshotEp)
      : supabase.from("score_cache").select("*").eq("group_id", groupId),
    supabase.from("profiles").select("id, display_name, avatar_url"),
    picksRevealed
      ? supabase
          .from("picks")
          .select(
            "player_id, trio_castaway_1, trio_castaway_2, trio_castaway_3, icky_castaway"
          )
      : Promise.resolve({ data: [] as Picks[], error: null }),
  ]);

  const memberIds = new Set(
    (membersRes.data ?? []).map((m: any) => m.user_id)
  );
  let scores = (scoresRes.data ?? []) as (ScoreCache | ScoreSnapshot)[];
  const profiles = (
    profilesRes.data as Pick<Profile, "id" | "display_name" | "avatar_url">[]
  ).filter((p) => memberIds.has(p.id));
  const picksData = (picksRes.data ?? []) as Picks[];
  let epShown = needsSnapshot ? snapshotEp : currentEpisode;

  // Snapshot fallback — same logic as iOS hook
  if (needsSnapshot && scores.length === 0) {
    const earlier = await supabase
      .from("score_snapshots")
      .select("*")
      .eq("group_id", groupId)
      .lt("episode_number", snapshotEp)
      .order("episode_number", { ascending: false })
      .limit(50);
    if (earlier.data && earlier.data.length > 0) {
      const latestEp = (earlier.data[0] as ScoreSnapshot).episode_number;
      scores = (earlier.data as ScoreSnapshot[]).filter(
        (s) => s.episode_number === latestEp
      );
      epShown = latestEp;
    } else {
      scores = [];
      epShown = 0;
    }
  }

  const picksMap = new Map(picksData.map((p) => [p.player_id, p]));

  const combined = profiles.map((profile) => {
    const score = scores.find((s) => s.player_id === profile.id);
    const pick = picksMap.get(profile.id);
    return {
      player_id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url ?? null,
      trio_points: score?.trio_points ?? 0,
      icky_points: score?.icky_points ?? 0,
      prophecy_points: score?.prophecy_points ?? 0,
      total_points: score?.total_points ?? 0,
      trio_castaways:
        picksRevealed && pick
          ? ([
              pick.trio_castaway_1,
              pick.trio_castaway_2,
              pick.trio_castaway_3,
            ] as [number, number, number])
          : null,
      icky_castaway: picksRevealed && pick ? pick.icky_castaway : null,
    } as Omit<PlayerScore, "rank" | "is_tied">;
  });

  return { entries: sortAndRankScores(combined), displayedEpisode: epShown };
}

export function useLeaderboard(options: Options) {
  const session = useAuthStore((s) => s.session);

  return useQuery({
    queryKey: [
      "leaderboard",
      options.groupId,
      options.currentEpisode,
      options.maxSeenEpisode,
      options.picksRevealed,
    ],
    queryFn: () => fetchLeaderboard(options),
    enabled: !!session && !!options.groupId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60, // poll every minute (Realtime can be added in polish phase)
  });
}
