import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/types';

async function fetchUserGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, groups(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row: any) => row.groups as Group);
}

export function useGroups() {
  const userId = useAuthStore((state) => state.session?.user.id);

  return useQuery({
    queryKey: ['my-groups', userId],
    queryFn: () => fetchUserGroups(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60,
  });
}
