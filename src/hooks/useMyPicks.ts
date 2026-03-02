import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Picks, ProphecyAnswer, ProphecyOutcome, ScoreCacheTrioDetail } from '@/types';

export interface MyPicksData {
  picks: Picks | null;
  prophecyAnswers: ProphecyAnswer[];
  prophecyOutcomes: ProphecyOutcome[];
  trioDetail: ScoreCacheTrioDetail[];
  trioPoints: number;
  ickyPoints: number;
  prophecyPoints: number;
  totalPoints: number;
  /** True when scores come from a snapshot instead of live data. */
  isSpoilerFiltered: boolean;
}

interface UseMyPicksOptions {
  spoilerEnabled?: boolean;
  maxSeenEpisode?: number;
  currentEpisode?: number;
}

async function fetchMyPicks(
  userId: string,
  groupId: string,
  snapshotEpisode: number | null,
): Promise<MyPicksData> {
  const [picksResult, answersResult, outcomesResult, trioDetailResult, scoreResult] = await Promise.all([
    // Picks and prophecy answers are per-player (no group_id)
    supabase.from('picks').select('*').eq('player_id', userId).maybeSingle(),
    supabase.from('prophecy_answers').select('*').eq('player_id', userId),
    supabase.from('prophecy_outcomes').select('*'),
    // Skip trio detail when in snapshot mode (no snapshot equivalent exists)
    snapshotEpisode === null
      ? supabase.from('score_cache_trio_detail').select('*').eq('player_id', userId).eq('group_id', groupId)
      : Promise.resolve({ data: [], error: null }),
    // Use snapshots or live scores
    snapshotEpisode !== null
      ? supabase.from('score_snapshots').select('*')
          .eq('player_id', userId)
          .eq('group_id', groupId)
          .eq('episode_number', snapshotEpisode)
          .maybeSingle()
      : supabase.from('score_cache').select('*').eq('player_id', userId).eq('group_id', groupId).maybeSingle(),
  ]);

  const scoreData = scoreResult.data as any;

  return {
    picks: picksResult.data as Picks | null,
    prophecyAnswers: (answersResult.data ?? []) as ProphecyAnswer[],
    prophecyOutcomes: (outcomesResult.data ?? []) as ProphecyOutcome[],
    trioDetail: (trioDetailResult.data ?? []) as ScoreCacheTrioDetail[],
    trioPoints: scoreData?.trio_points ?? 0,
    ickyPoints: scoreData?.icky_points ?? 0,
    prophecyPoints: scoreData?.prophecy_points ?? 0,
    totalPoints: scoreData?.total_points ?? 0,
    isSpoilerFiltered: snapshotEpisode !== null,
  };
}

export function useMyPicks(options: UseMyPicksOptions = {}) {
  const { spoilerEnabled = false, maxSeenEpisode = 0, currentEpisode = 0 } = options;
  const userId = useAuthStore((state) => state.session?.user.id);
  const groupId = useAuthStore((state) => state.activeGroup?.id);

  const needsSnapshot = spoilerEnabled && maxSeenEpisode < currentEpisode && currentEpisode > 0;
  const snapshotEpisode = needsSnapshot ? maxSeenEpisode : null;

  return useQuery({
    queryKey: ['my-picks', userId, groupId, snapshotEpisode ?? 'live'],
    queryFn: () => fetchMyPicks(userId!, groupId!, snapshotEpisode),
    enabled: !!userId && !!groupId,
    staleTime: 1000 * 30, // 30 seconds
  });
}
