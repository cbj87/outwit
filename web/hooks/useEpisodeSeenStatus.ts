import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

export function useEpisodeSeenStatus() {
  const userId = useAuthStore((s) => s.session?.user.id);

  const query = useQuery({
    queryKey: ["episode-seen-status", userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("episode_seen_status")
        .select("episode_number")
        .eq("player_id", userId!);
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
  });

  const maxSeenEpisode =
    query.data && query.data.length > 0
      ? Math.max(...query.data.map((r: { episode_number: number }) => r.episode_number))
      : 0;

  return { maxSeenEpisode, isLoading: query.isLoading };
}
