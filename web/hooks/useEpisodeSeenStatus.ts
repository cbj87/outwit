import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

export function useEpisodeSeenStatus() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  const queryKey = ["episode-seen-status", userId];

  const query = useQuery<number[]>({
    queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("episode_seen_status")
        .select("episode_number")
        .eq("player_id", userId!);
      return (data ?? []).map((r: { episode_number: number }) => r.episode_number);
    },
    enabled: !!userId,
    staleTime: 0,
  });

  const seenEpisodes = useMemo(() => new Set(query.data ?? []), [query.data]);
  const maxSeenEpisode = useMemo(
    () => (seenEpisodes.size > 0 ? Math.max(...seenEpisodes) : 0),
    [seenEpisodes]
  );

  type SeenContext = { previous?: number[] };

  const markOneMutation = useMutation<void, Error, number, SeenContext>({
    mutationFn: async (episodeNumber: number) => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("episode_seen_status")
        .upsert(
          { player_id: userId, episode_number: episodeNumber },
          { onConflict: "player_id,episode_number" }
        );
      if (error) throw error;
    },
    onMutate: async (episodeNumber: number) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<number[]>(queryKey);
      queryClient.setQueryData<number[]>(queryKey, (old) => {
        const set = new Set(old ?? []);
        set.add(episodeNumber);
        return [...set];
      });
      return { previous };
    },
    onError: (_err: Error, _ep: number, context: SeenContext | undefined) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markThroughMutation = useMutation<void, Error, number, SeenContext>({
    mutationFn: async (throughEpisode: number) => {
      if (!userId || throughEpisode < 1) return;
      const rows: { player_id: string; episode_number: number }[] = [];
      for (let ep = 1; ep <= throughEpisode; ep++) {
        rows.push({ player_id: userId, episode_number: ep });
      }
      const supabase = createClient();
      const { error } = await supabase
        .from("episode_seen_status")
        .upsert(rows, { onConflict: "player_id,episode_number" });
      if (error) throw error;
    },
    onMutate: async (throughEpisode: number) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<number[]>(queryKey);
      queryClient.setQueryData<number[]>(queryKey, (old) => {
        const set = new Set(old ?? []);
        for (let ep = 1; ep <= throughEpisode; ep++) set.add(ep);
        return [...set];
      });
      return { previous };
    },
    onError: (_err: Error, _through: number, context: SeenContext | undefined) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markEpisodeSeen = useCallback(
    async (episodeNumber: number) => {
      await markOneMutation.mutateAsync(episodeNumber);
    },
    [markOneMutation]
  );

  const markAllSeenThrough = useCallback(
    async (throughEpisode: number) => {
      await markThroughMutation.mutateAsync(throughEpisode);
    },
    [markThroughMutation]
  );

  return {
    seenEpisodes,
    maxSeenEpisode,
    isLoading: query.isLoading,
    isMarking: markOneMutation.isPending || markThroughMutation.isPending,
    markEpisodeSeen,
    markAllSeenThrough,
  };
}
