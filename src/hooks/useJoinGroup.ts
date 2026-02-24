import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/types';

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { session, setActiveGroup } = useAuthStore();

  return useMutation({
    mutationFn: async (inviteCode: string): Promise<Group> => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const code = inviteCode.trim().toUpperCase();

      // Look up the group by invite code
      const { data: group, error: lookupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code)
        .single();

      if (lookupError || !group) throw new Error('Invalid invite code');

      // Check if already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) throw new Error('You are already in this group');

      // Join the group
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId });

      if (joinError) throw joinError;

      // Set as active group
      await supabase
        .from('profiles')
        .update({ active_group_id: group.id })
        .eq('id', userId);

      return group as Group;
    },
    onSuccess: (group) => {
      setActiveGroup(group);
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
      queryClient.invalidateQueries({ queryKey: ['all-picks'] });
    },
  });
}
