import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/types';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { session, setActiveGroup } = useAuthStore();

  return useMutation({
    mutationFn: async (name: string): Promise<Group> => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const inviteCode = generateInviteCode();

      // Insert the group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name,
          invite_code: inviteCode,
          created_by: userId,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as a member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId });

      if (memberError) throw memberError;

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
