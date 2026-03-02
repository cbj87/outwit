import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/**
 * Tracks which episodes the current user has marked as "seen."
 * Used by the leaderboard to avoid spoiling unseen episode results.
 */
export function useEpisodeSeenStatus() {
  const session = useAuthStore((state) => state.session);
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  const queryKey = ['episode-seen', userId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('episode_seen_status')
        .select('episode_number')
        .eq('player_id', userId!);
      if (error) throw error;
      return (data ?? []).map((r: { episode_number: number }) => r.episode_number);
    },
    enabled: !!userId,
    staleTime: Infinity, // only changes via our own mutations
  });

  const seenEpisodes = useMemo(() => new Set(query.data ?? []), [query.data]);
  const maxSeenEpisode = useMemo(
    () => (seenEpisodes.size > 0 ? Math.max(...seenEpisodes) : 0),
    [seenEpisodes],
  );

  const markOneMutation = useMutation({
    mutationFn: async (episodeNumber: number) => {
      if (!userId) return;
      const { error } = await supabase
        .from('episode_seen_status')
        .upsert(
          { player_id: userId, episode_number: episodeNumber },
          { onConflict: 'player_id,episode_number' },
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
    onError: (_err, _ep, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markThroughMutation = useMutation({
    mutationFn: async (throughEpisode: number) => {
      if (!userId || throughEpisode < 1) return;
      // Always upsert all rows — do NOT read from cache here because
      // onMutate has already optimistically updated it, which would cause
      // this function to think no rows need inserting and skip the DB write.
      const rows: { player_id: string; episode_number: number }[] = [];
      for (let ep = 1; ep <= throughEpisode; ep++) {
        rows.push({ player_id: userId, episode_number: ep });
      }
      const { error } = await supabase
        .from('episode_seen_status')
        .upsert(rows, { onConflict: 'player_id,episode_number' });
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
    onError: (_err, _through, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  /** Mark a single episode as seen (inserts row). */
  const markEpisodeSeen = useCallback(
    async (episodeNumber: number) => {
      await markOneMutation.mutateAsync(episodeNumber);
    },
    [markOneMutation],
  );

  /** Mark all episodes up through a given number as seen. */
  const markAllSeenThrough = useCallback(
    async (throughEpisode: number) => {
      await markThroughMutation.mutateAsync(throughEpisode);
    },
    [markThroughMutation],
  );

  return {
    seenEpisodes,
    maxSeenEpisode,
    isLoading: query.isLoading,
    markEpisodeSeen,
    markAllSeenThrough,
    refetch: query.refetch,
  };
}
