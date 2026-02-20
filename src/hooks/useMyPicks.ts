import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Picks, ProphecyAnswer, ScoreCacheTrioDetail } from '@/types';

interface MyPicksData {
  picks: Picks | null;
  prophecyAnswers: ProphecyAnswer[];
  trioDetail: ScoreCacheTrioDetail[];
  trioPoints: number;
  ickyPoints: number;
  prophecyPoints: number;
  totalPoints: number;
}

async function fetchMyPicks(userId: string): Promise<MyPicksData> {
  const [picksResult, answersResult, trioDetailResult, cacheResult] = await Promise.all([
    supabase.from('picks').select('*').eq('player_id', userId).maybeSingle(),
    supabase.from('prophecy_answers').select('*').eq('player_id', userId),
    supabase.from('score_cache_trio_detail').select('*').eq('player_id', userId),
    supabase.from('score_cache').select('*').eq('player_id', userId).maybeSingle(),
  ]);

  return {
    picks: picksResult.data as Picks | null,
    prophecyAnswers: (answersResult.data ?? []) as ProphecyAnswer[],
    trioDetail: (trioDetailResult.data ?? []) as ScoreCacheTrioDetail[],
    trioPoints: (cacheResult.data as any)?.trio_points ?? 0,
    ickyPoints: (cacheResult.data as any)?.icky_points ?? 0,
    prophecyPoints: (cacheResult.data as any)?.prophecy_points ?? 0,
    totalPoints: (cacheResult.data as any)?.total_points ?? 0,
  };
}

export function useMyPicks() {
  const userId = useAuthStore((state) => state.session?.user.id);

  return useQuery({
    queryKey: ['my-picks', userId],
    queryFn: () => fetchMyPicks(userId!),
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });
}
