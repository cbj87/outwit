import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { defaultTribeColors } from '@/theme/colors';

interface TribeColorRow {
  tribe_name: string;
  color: string;
}

async function fetchTribeColors(): Promise<TribeColorRow[]> {
  const { data, error } = await supabase
    .from('tribe_colors')
    .select('tribe_name, color');

  if (error) throw error;
  return data as TribeColorRow[];
}

export function useTribeColors() {
  const session = useAuthStore((state) => state.session);

  const { data: rows } = useQuery({
    queryKey: ['tribe_colors'],
    queryFn: fetchTribeColors,
    enabled: !!session,
    staleTime: 1000 * 60 * 10, // 10 minutes — rarely changes
  });

  const tribeColors = useMemo(() => {
    const map: Record<string, string> = { ...defaultTribeColors };
    if (rows) {
      for (const row of rows) {
        map[row.tribe_name] = row.color;
      }
    }
    return map;
  }, [rows]);

  return tribeColors;
}

export function useTribeColorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tribe, color }: { tribe: string; color: string }) => {
      const { error } = await supabase
        .from('tribe_colors')
        .upsert({ tribe_name: tribe, color }, { onConflict: 'tribe_name' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tribe_colors'] });
    },
  });
}
