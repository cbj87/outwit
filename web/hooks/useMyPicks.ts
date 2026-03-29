import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type {
  Picks,
  ProphecyAnswer,
  ProphecyOutcome,
  ScoreCacheTrioDetail,
} from "@shared/types";

export interface MyPicksData {
  picks: Picks | null;
  prophecyAnswers: ProphecyAnswer[];
  prophecyOutcomes: ProphecyOutcome[];
  trioDetail: ScoreCacheTrioDetail[];
  trioPoints: number;
  ickyPoints: number;
  prophecyPoints: number;
  totalPoints: number;
  isSpoilerFiltered: boolean;
}

interface Options {
  spoilerEnabled?: boolean;
  maxSeenEpisode?: number;
  currentEpisode?: number;
}

export function useMyPicks(options: Options = {}) {
  const { spoilerEnabled = false, maxSeenEpisode = 0, currentEpisode = 0 } =
    options;
  const userId = useAuthStore((s) => s.session?.user.id);
  const groupId = useAuthStore((s) => s.activeGroup?.id);

  const needsSnapshot =
    spoilerEnabled && maxSeenEpisode < currentEpisode && currentEpisode > 0;
  const snapshotEp = needsSnapshot ? maxSeenEpisode : null;

  return useQuery({
    queryKey: ["my-picks", userId, groupId, snapshotEp ?? "live"],
    queryFn: async (): Promise<MyPicksData> => {
      const supabase = createClient();
      const [picksRes, answersRes, outcomesRes, trioDetailRes, scoreRes] =
        await Promise.all([
          supabase
            .from("picks")
            .select("*")
            .eq("player_id", userId!)
            .maybeSingle(),
          supabase
            .from("prophecy_answers")
            .select("*")
            .eq("player_id", userId!),
          supabase.from("prophecy_outcomes").select("*"),
          snapshotEp === null
            ? supabase
                .from("score_cache_trio_detail")
                .select("*")
                .eq("player_id", userId!)
                .eq("group_id", groupId!)
            : Promise.resolve({ data: [], error: null }),
          snapshotEp !== null
            ? supabase
                .from("score_snapshots")
                .select("*")
                .eq("player_id", userId!)
                .eq("group_id", groupId!)
                .eq("episode_number", snapshotEp)
                .maybeSingle()
            : supabase
                .from("score_cache")
                .select("*")
                .eq("player_id", userId!)
                .eq("group_id", groupId!)
                .maybeSingle(),
        ]);

      const scoreData = scoreRes.data as any;
      return {
        picks: picksRes.data as Picks | null,
        prophecyAnswers: (answersRes.data ?? []) as ProphecyAnswer[],
        prophecyOutcomes: (outcomesRes.data ?? []) as ProphecyOutcome[],
        trioDetail: (trioDetailRes.data ?? []) as ScoreCacheTrioDetail[],
        trioPoints: scoreData?.trio_points ?? 0,
        ickyPoints: scoreData?.icky_points ?? 0,
        prophecyPoints: scoreData?.prophecy_points ?? 0,
        totalPoints: scoreData?.total_points ?? 0,
        isSpoilerFiltered: snapshotEp !== null,
      };
    },
    enabled: !!userId && !!groupId,
    staleTime: 1000 * 30,
  });
}
