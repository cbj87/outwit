import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sortAndRankScores } from '@/lib/scoring';
import type { PlayerScore, ScoreCache, Profile, Picks } from '@/types';

interface LeaderboardEntry extends PlayerScore {}

export function useLeaderboard(picksRevealed: boolean, groupId: string | null) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const picksRevealedRef = useRef(picksRevealed);
  picksRevealedRef.current = picksRevealed;
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const fetchLeaderboard = useCallback(async () => {
    const revealed = picksRevealedRef.current;
    const gid = groupIdRef.current;

    if (!gid) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    // Fetch group members, scores, and profiles in parallel
    const [membersResult, scoresResult, profilesResult, picksResult] = await Promise.all([
      supabase.from('group_members').select('user_id').eq('group_id', gid),
      supabase.from('score_cache').select('*').eq('group_id', gid),
      supabase.from('profiles').select('id, display_name, avatar_url'),
      // Picks are per-player (no group_id) — filter to group members client-side
      revealed
        ? supabase.from('picks').select('player_id, trio_castaway_1, trio_castaway_2, trio_castaway_3, icky_castaway')
        : Promise.resolve({ data: [] as Picks[], error: null }),
    ]);

    if (membersResult.error || scoresResult.error || profilesResult.error) return;

    const memberIds = new Set((membersResult.data ?? []).map((m: any) => m.user_id));
    const scores = scoresResult.data as ScoreCache[];
    const profiles = (profilesResult.data as Pick<Profile, 'id' | 'display_name' | 'avatar_url'>[])
      .filter((p) => memberIds.has(p.id));
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

    if (!groupId) return;

    // Subscribe to score cache + profile changes for live updates
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
  }, [picksRevealed, groupId]);

  return { entries, isLoading, refetch: fetchLeaderboard };
}
