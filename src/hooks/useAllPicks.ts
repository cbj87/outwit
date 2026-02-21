import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useSeasonConfig } from './useSeasonConfig';
import type { Picks, Profile } from '@/types';

export interface PlayerPick {
  player_id: string;
  display_name: string;
  avatar_url: string | null;
  trio: [number, number, number];
  icky: number;
}

/** Map from castaway ID → { trio pickers, icky pickers } */
export type CastawayPickMap = Map<
  number,
  { trio: PlayerPick[]; icky: PlayerPick[] }
>;

async function fetchAllPicks(): Promise<PlayerPick[]> {
  const [picksResult, profilesResult] = await Promise.all([
    supabase
      .from('picks')
      .select('player_id, trio_castaway_1, trio_castaway_2, trio_castaway_3, icky_castaway'),
    supabase.from('profiles').select('id, display_name, avatar_url'),
  ]);

  if (picksResult.error || profilesResult.error) throw picksResult.error ?? profilesResult.error;

  const picks = picksResult.data as Picks[];
  const profiles = profilesResult.data as Pick<Profile, 'id' | 'display_name' | 'avatar_url'>[];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return picks.map((pick) => {
    const profile = profileMap.get(pick.player_id);
    return {
      player_id: pick.player_id,
      display_name: profile?.display_name ?? '?',
      avatar_url: profile?.avatar_url ?? null,
      trio: [pick.trio_castaway_1, pick.trio_castaway_2, pick.trio_castaway_3],
      icky: pick.icky_castaway,
    };
  });
}

function buildCastawayPickMap(playerPicks: PlayerPick[]): CastawayPickMap {
  const map: CastawayPickMap = new Map();

  function ensure(id: number) {
    if (!map.has(id)) map.set(id, { trio: [], icky: [] });
    return map.get(id)!;
  }

  for (const pp of playerPicks) {
    for (const cId of pp.trio) {
      ensure(cId).trio.push(pp);
    }
    ensure(pp.icky).icky.push(pp);
  }

  return map;
}

export function useAllPicks() {
  const session = useAuthStore((state) => state.session);
  const { config } = useSeasonConfig();
  const revealed = config?.picks_revealed ?? false;

  const query = useQuery({
    queryKey: ['all-picks'],
    queryFn: fetchAllPicks,
    enabled: !!session && revealed,
    staleTime: 1000 * 60 * 5,
  });

  const castawayPickMap = query.data ? buildCastawayPickMap(query.data) : null;

  return { ...query, castawayPickMap, revealed };
}
