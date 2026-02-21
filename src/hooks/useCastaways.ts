import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Castaway } from '@/types';

async function fetchCastaways(): Promise<Castaway[]> {
  const { data, error } = await supabase
    .from('castaways')
    .select('*')
    .order('current_tribe')
    .order('name');

  if (error) throw error;
  return data as Castaway[];
}

export function useCastaways() {
  const session = useAuthStore((state) => state.session);

  return useQuery({
    queryKey: ['castaways'],
    queryFn: fetchCastaways,
    enabled: !!session,
    staleTime: 1000 * 60 * 5, // 5 minutes — castaway data rarely changes
  });
}

export function useCastawaysByTribe() {
  const { data: castaways, ...rest } = useCastaways();

  const byTribe = castaways?.reduce<Record<string, Castaway[]>>(
    (acc, castaway) => {
      const tribe = castaway.current_tribe;
      if (!acc[tribe]) acc[tribe] = [];
      acc[tribe].push(castaway);
      return acc;
    },
    {},
  );

  return { byTribe, castaways, ...rest };
}

export function useCastawayMap() {
  const { data: castaways } = useCastaways();
  const map = new Map<number, Castaway>();
  castaways?.forEach((c) => map.set(c.id, c));
  return map;
}
