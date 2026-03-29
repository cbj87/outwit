import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { SeasonConfig } from "@shared/types";

export function useSeasonConfig() {
  const session = useAuthStore((s) => s.session);
  const activeGroup = useAuthStore((s) => s.activeGroup);

  const query = useQuery({
    queryKey: ["season-config"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("season_config")
        .select("*")
        .eq("id", 1)
        .single();
      return data as SeasonConfig;
    },
    enabled: !!session,
    staleTime: 1000 * 60,
  });

  // Merge group-level overrides on top of global config
  const config =
    query.data && activeGroup
      ? {
          ...query.data,
          picks_deadline: activeGroup.picks_deadline,
          picks_revealed: activeGroup.picks_revealed,
          current_episode: activeGroup.current_episode,
        }
      : query.data ?? null;

  const isPicksLocked = activeGroup
    ? activeGroup.picks_revealed ||
      new Date() > new Date(activeGroup.picks_deadline)
    : false;

  return { config, isLoading: query.isLoading, isPicksLocked };
}
