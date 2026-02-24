import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const { session, activeGroup, setActiveGroup } = useAuthStore();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      // If we left the active group, clear it
      if (activeGroup?.id === groupId) {
        setActiveGroup(null);
        await supabase
          .from('profiles')
          .update({ active_group_id: null })
          .eq('id', userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
      queryClient.invalidateQueries({ queryKey: ['all-picks'] });
    },
  });
}
