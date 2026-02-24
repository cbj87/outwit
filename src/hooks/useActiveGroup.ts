import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/types';

export function useActiveGroup() {
  const { activeGroup, isGroupCommissioner, profile, setActiveGroup } = useAuthStore();
  const queryClient = useQueryClient();

  const switchGroup = useCallback(async (group: Group) => {
    if (!profile) return;

    // Update the store immediately for snappy UI
    setActiveGroup(group);

    // Persist to DB
    await supabase
      .from('profiles')
      .update({ active_group_id: group.id })
      .eq('id', profile.id);

    // Invalidate all group-scoped queries so they refetch with the new group
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['my-picks'] });
    queryClient.invalidateQueries({ queryKey: ['all-picks'] });
  }, [profile, setActiveGroup, queryClient]);

  return { activeGroup, isGroupCommissioner, switchGroup };
}
