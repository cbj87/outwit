import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Profile, Group } from '@/types';

export function useAuth() {
  const { session, profile, isLoading, isCommissioner, activeGroup, isGroupCommissioner, setSession, setProfile, setActiveGroup, setIsLoading, reset } =
    useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        // Invalidate all queries so they re-fetch with the authenticated session
        queryClient.invalidateQueries();
      } else {
        reset();
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    setIsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const profileData = data as Profile | null;
    setProfile(profileData);

    // Fetch active group if one is set
    if (profileData?.active_group_id) {
      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .eq('id', profileData.active_group_id)
        .single();

      setActiveGroup(groupData as Group | null);
    } else {
      setActiveGroup(null);
    }

    setIsLoading(false);
  }

  async function refreshProfile() {
    if (session?.user.id) {
      await fetchProfile(session.user.id);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    reset();
  }

  return { session, profile, isLoading, isCommissioner, activeGroup, isGroupCommissioner, signOut, refreshProfile };
}
