import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { Picks, Profile } from "@shared/types";

export interface PlayerPick {
  player_id: string;
  display_name: string;
  avatar_url: string | null;
  trio: [number, number, number];
  icky: number;
}

export type CastawayPickMap = Map<
  number,
  { trio: PlayerPick[]; icky: PlayerPick[] }
>;

export function buildCastawayPickMap(playerPicks: PlayerPick[]): CastawayPickMap {
  const map: CastawayPickMap = new Map();
  const ensure = (id: number) => {
    if (!map.has(id)) map.set(id, { trio: [], icky: [] });
    return map.get(id)!;
  };
  for (const pp of playerPicks) {
    for (const cId of pp.trio) ensure(cId).trio.push(pp);
    ensure(pp.icky).icky.push(pp);
  }
  return map;
}

export function useAllPicks() {
  const session = useAuthStore((s) => s.session);
  const activeGroup = useAuthStore((s) => s.activeGroup);
  const revealed = activeGroup?.picks_revealed ?? false;
  const groupId = activeGroup?.id;

  const query = useQuery({
    queryKey: ["all-picks", groupId],
    queryFn: async () => {
      const supabase = createClient();
      const [picksRes, profilesRes, membersRes] = await Promise.all([
        supabase
          .from("picks")
          .select(
            "player_id, trio_castaway_1, trio_castaway_2, trio_castaway_3, icky_castaway"
          ),
        supabase.from("profiles").select("id, display_name, avatar_url"),
        supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", groupId!),
      ]);

      const memberIds = new Set(
        (membersRes.data ?? []).map((m: any) => m.user_id)
      );
      const picks = (picksRes.data as Picks[]).filter((p) =>
        memberIds.has(p.player_id)
      );
      const profiles = profilesRes.data as Pick<
        Profile,
        "id" | "display_name" | "avatar_url"
      >[];
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return picks.map((pick) => {
        const profile = profileMap.get(pick.player_id);
        return {
          player_id: pick.player_id,
          display_name: profile?.display_name ?? "?",
          avatar_url: profile?.avatar_url ?? null,
          trio: [
            pick.trio_castaway_1,
            pick.trio_castaway_2,
            pick.trio_castaway_3,
          ] as [number, number, number],
          icky: pick.icky_castaway,
        } satisfies PlayerPick;
      });
    },
    enabled: !!session && !!groupId && revealed,
    staleTime: 1000 * 60 * 5,
  });

  const castawayPickMap = query.data
    ? buildCastawayPickMap(query.data)
    : null;

  return { ...query, castawayPickMap, revealed };
}
