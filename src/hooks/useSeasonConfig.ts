import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { SeasonConfig } from '@/types';

export function useSeasonConfig() {
  const [config, setConfig] = useState<SeasonConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeGroup = useAuthStore((state) => state.activeGroup);

  function refetch() {
    supabase
      .from('season_config')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data as SeasonConfig);
      });
  }

  useEffect(() => {
    // Initial fetch of global season config (for season_name)
    supabase
      .from('season_config')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setConfig(data as SeasonConfig);
        setIsLoading(false);
      });

    // Realtime subscription for global season config changes
    const channel = supabase
      .channel('season_config_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'season_config', filter: 'id=eq.1' },
        (payload) => {
          setConfig(payload.new as SeasonConfig);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Picks locked state is derived from the active group, not global season_config
  const isPicksLocked = activeGroup
    ? activeGroup.picks_revealed || new Date() > new Date(activeGroup.picks_deadline)
    : false;

  // Merge group-level overrides into a "config-like" view
  const effectiveConfig = config && activeGroup
    ? {
        ...config,
        picks_deadline: activeGroup.picks_deadline,
        picks_revealed: activeGroup.picks_revealed,
        current_episode: activeGroup.current_episode,
      }
    : config;

  return { config: effectiveConfig, isLoading, isPicksLocked, refetch, activeGroup };
}
