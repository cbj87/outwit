import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SeasonConfig } from '@/types';

export function useSeasonConfig() {
  const [config, setConfig] = useState<SeasonConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    // Initial fetch
    supabase
      .from('season_config')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setConfig(data as SeasonConfig);
        setIsLoading(false);
      });

    // Realtime subscription for live updates (reveal, episode changes)
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

  const isPicksLocked = config
    ? config.picks_revealed || new Date() > new Date(config.picks_deadline)
    : false;

  return { config, isLoading, isPicksLocked, refetch };
}
