import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/**
 * Tracks which episodes the current user has marked as "seen."
 * Used by the leaderboard to avoid spoiling unseen episode results.
 */
export function useEpisodeSeenStatus() {
  const session = useAuthStore((state) => state.session);
  const userId = session?.user.id ?? null;
  const [seenEpisodes, setSeenEpisodes] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchSeen = useCallback(async () => {
    if (!userId) {
      setSeenEpisodes(new Set());
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from('episode_seen_status')
      .select('episode_number')
      .eq('player_id', userId);

    setSeenEpisodes(new Set((data ?? []).map((r: any) => r.episode_number)));
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSeen();
  }, [fetchSeen]);

  /** The highest episode number the user has seen (0 if none). */
  const maxSeenEpisode = seenEpisodes.size > 0 ? Math.max(...seenEpisodes) : 0;

  /** Mark a single episode as seen (inserts row). */
  const markEpisodeSeen = useCallback(async (episodeNumber: number) => {
    if (!userId) return;

    const { error } = await supabase
      .from('episode_seen_status')
      .upsert(
        { player_id: userId, episode_number: episodeNumber },
        { onConflict: 'player_id,episode_number' },
      );

    if (!error) {
      setSeenEpisodes((prev) => new Set([...prev, episodeNumber]));
    }
  }, [userId]);

  /** Mark all episodes up through a given number as seen. */
  const markAllSeenThrough = useCallback(async (throughEpisode: number) => {
    if (!userId || throughEpisode < 1) return;

    const rows = [];
    for (let ep = 1; ep <= throughEpisode; ep++) {
      if (!seenEpisodes.has(ep)) {
        rows.push({ player_id: userId, episode_number: ep });
      }
    }

    if (rows.length === 0) return;

    const { error } = await supabase
      .from('episode_seen_status')
      .upsert(rows, { onConflict: 'player_id,episode_number' });

    if (!error) {
      setSeenEpisodes((prev) => {
        const next = new Set(prev);
        for (let ep = 1; ep <= throughEpisode; ep++) next.add(ep);
        return next;
      });
    }
  }, [userId, seenEpisodes]);

  return {
    seenEpisodes,
    maxSeenEpisode,
    isLoading,
    markEpisodeSeen,
    markAllSeenThrough,
    refetch: fetchSeen,
  };
}
