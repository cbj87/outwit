import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sortAndRankScores } from '@/lib/scoring';
import type { PlayerScore, ScoreCache, Profile, Picks } from '@/types';

interface LeaderboardEntry extends PlayerScore {}

export function useLeaderboard(picksRevealed: boolean) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const picksRevealedRef = useRef(picksRevealed);
  picksRevealedRef.current = picksRevealed;

  const fetchLeaderboard = useCallback(async () => {
    const revealed = picksRevealedRef.current;
    // Fetch score cache + profiles in parallel
    const [scoresResult, profilesResult, picksResult] = await Promise.all([
      supabase.from('score_cache').select('*'),
      supabase.from('profiles').select('id, display_name, avatar_url'),
      revealed
        ? supabase.from('picks').select('player_id, trio_castaway_1, trio_castaway_2, trio_castaway_3, icky_castaway')
        : Promise.resolve({ data: [] as Picks[], error: null }),
    ]);

    if (scoresResult.error || profilesResult.error) return;

    const scores = scoresResult.data as ScoreCache[];
    const profiles = profilesResult.data as Pick<Profile, 'id' | 'display_name' | 'avatar_url'>[];
    const picksData = picksResult.data as Picks[];

    const picksMap = new Map(picksData.map((p) => [p.player_id, p]));

    const combined: Omit<LeaderboardEntry, 'rank' | 'is_tied'>[] = profiles.map((profile) => {
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
        trio_castaways: revealed && pick
          ? [pick.trio_castaway_1, pick.trio_castaway_2, pick.trio_castaway_3]
          : null,
        icky_castaway: revealed && pick ? pick.icky_castaway : null,
      };
    });

    const ranked = sortAndRankScores(combined);
    setEntries(ranked);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to score cache + profile changes for live updates
    const channel = supabase
      .channel('leaderboard_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_cache' },
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
  }, [picksRevealed]);

  return { entries, isLoading, refetch: fetchLeaderboard };
}
