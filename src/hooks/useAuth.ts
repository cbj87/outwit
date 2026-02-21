import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Profile } from '@/types';

export function useAuth() {
  const { session, profile, isLoading, isCommissioner, setSession, setProfile, setIsLoading, reset } =
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

    setProfile(data as Profile | null);
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

  return { session, profile, isLoading, isCommissioner, signOut, refreshProfile };
}
