import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sortAndRankScores } from '@/lib/scoring';
import type { PlayerScore, ScoreCache, ScoreSnapshot, Profile, Picks } from '@/types';

interface LeaderboardEntry extends PlayerScore {}

interface UseLeaderboardOptions {
  picksRevealed: boolean;
  groupId: string | null;
  /** Current episode number for the group. */
  currentEpisode: number;
  /** Highest episode the user has marked as seen (0 = none). */
  maxSeenEpisode: number;
  /** True while episode seen data is still loading. */
  seenLoading?: boolean;
}

export function useLeaderboard({
  picksRevealed,
  groupId,
  currentEpisode,
  maxSeenEpisode,
  seenLoading,
}: UseLeaderboardOptions) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** The episode number the displayed scores reflect. */
  const [displayedEpisode, setDisplayedEpisode] = useState(0);

  const picksRevealedRef = useRef(picksRevealed);
  picksRevealedRef.current = picksRevealed;
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;
  const currentEpisodeRef = useRef(currentEpisode);
  currentEpisodeRef.current = currentEpisode;
  const maxSeenRef = useRef(maxSeenEpisode);
  maxSeenRef.current = maxSeenEpisode;

  const fetchLeaderboard = useCallback(async () => {
    const revealed = picksRevealedRef.current;
    const gid = groupIdRef.current;
    const curEp = currentEpisodeRef.current;
    const maxSeen = maxSeenRef.current;

    if (!gid) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    // Decide whether to use snapshots or live score_cache.
    // Use snapshots when: user has seen episodes, hasn't caught up, and snapshots may exist.
    const needsSnapshot = maxSeen > 0 && maxSeen < curEp;

    // Fetch group members, scores, and profiles in parallel
    const [membersResult, scoresResult, profilesResult, picksResult] = await Promise.all([
      supabase.from('group_members').select('user_id').eq('group_id', gid),
      needsSnapshot
        ? supabase
            .from('score_snapshots')
            .select('*')
            .eq('group_id', gid)
            .eq('episode_number', maxSeen)
        : supabase.from('score_cache').select('*').eq('group_id', gid),
      supabase.from('profiles').select('id, display_name, avatar_url'),
      revealed
        ? supabase.from('picks').select('player_id, trio_castaway_1, trio_castaway_2, trio_castaway_3, icky_castaway')
        : Promise.resolve({ data: [] as Picks[], error: null }),
    ]);

    if (membersResult.error || scoresResult.error || profilesResult.error) return;

    const memberIds = new Set((membersResult.data ?? []).map((m: any) => m.user_id));
    const scores = scoresResult.data as (ScoreCache | ScoreSnapshot)[];
    const profiles = (profilesResult.data as Pick<Profile, 'id' | 'display_name' | 'avatar_url'>[])
      .filter((p) => memberIds.has(p.id));
    const picksData = picksResult.data as Picks[];

    // If we tried snapshots but got no rows, find the closest earlier
    // snapshot instead of falling back to live scores (which would spoil).
    let finalScores = scores;
    let epShown = needsSnapshot ? maxSeen : curEp;
    if (needsSnapshot && scores.length === 0) {
      const earlier = await supabase
        .from('score_snapshots')
        .select('*')
        .eq('group_id', gid)
        .lt('episode_number', maxSeen)
        .order('episode_number', { ascending: false })
        .limit(50); // enough to cover all players in a group

      if (earlier.data && earlier.data.length > 0) {
        const latestEp = (earlier.data[0] as ScoreSnapshot).episode_number;
        finalScores = (earlier.data as ScoreSnapshot[]).filter(
          (s) => s.episode_number === latestEp,
        );
        epShown = latestEp;
      } else {
        // No snapshots exist at all — show zeroed scores (pre-season)
        finalScores = [];
        epShown = 0;
      }
    }

    const picksMap = new Map(picksData.map((p) => [p.player_id, p]));

    const combined: Omit<LeaderboardEntry, 'rank' | 'is_tied'>[] = profiles.map((profile) => {
      const score = finalScores.find((s) => s.player_id === profile.id);
      const pick = picksMap.get(profile.id);

      return {
        player_id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url ?? null,
        trio_points: score?.trio_points ?? 0,
        icky_points: score?.icky_points ?? 0,
        prophecy_points: score?.prophecy_points ?? 0,
        total_points: score?.total_points ?? 0,
        trio_castaways: revealed && pick
          ? [pick.trio_castaway_1, pick.trio_castaway_2, pick.trio_castaway_3]
          : null,
        icky_castaway: revealed && pick ? pick.icky_castaway : null,
      };
    });

    const ranked = sortAndRankScores(combined);
    setEntries(ranked);
    setDisplayedEpisode(epShown);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Don't fetch until seen status is loaded so we pick the right source
    if (seenLoading) return;

    fetchLeaderboard();

    if (!groupId) return;

    const channel = supabase
      .channel(`leaderboard_${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_cache', filter: `group_id=eq.${groupId}` },
        () => fetchLeaderboard(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => fetchLeaderboard(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [picksRevealed, groupId, maxSeenEpisode, seenLoading]);

  return { entries, isLoading, displayedEpisode, refetch: fetchLeaderboard };
}
