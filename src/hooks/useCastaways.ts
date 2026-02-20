import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Castaway, Tribe } from '@/types';

async function fetchCastaways(): Promise<Castaway[]> {
  const { data, error } = await supabase
    .from('castaways')
    .select('*')
    .order('tribe')
    .order('name');

  if (error) throw error;
  return data as Castaway[];
}

export function useCastaways() {
  return useQuery({
    queryKey: ['castaways'],
    queryFn: fetchCastaways,
    staleTime: 1000 * 60 * 5, // 5 minutes — castaway data rarely changes
  });
}

export function useCastawaysByTribe() {
  const { data: castaways, ...rest } = useCastaways();

  const byTribe = castaways?.reduce<Record<Tribe, Castaway[]>>(
    (acc, castaway) => {
      acc[castaway.tribe].push(castaway);
      return acc;
    },
    { VATU: [], CILA: [], KALO: [] },
  );

  return { byTribe, castaways, ...rest };
}

export function useCastawayMap() {
  const { data: castaways } = useCastaways();
  const map = new Map<number, Castaway>();
  castaways?.forEach((c) => map.set(c.id, c));
  return map;
}
