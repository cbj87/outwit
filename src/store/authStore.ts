import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, Group } from '@/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isCommissioner: boolean;
  activeGroup: Group | null;
  isGroupCommissioner: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setActiveGroup: (group: Group | null) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  isCommissioner: false,
  activeGroup: null,
  isGroupCommissioner: false,
  setSession: (session) => set({ session }),
  setProfile: (profile) =>
    set({ profile, isCommissioner: profile?.is_commissioner ?? false }),
  setActiveGroup: (group) => {
    const userId = get().session?.user.id;
    set({
      activeGroup: group,
      isGroupCommissioner: !!group && !!userId && group.created_by === userId,
    });
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  reset: () => set({
    session: null,
    profile: null,
    isLoading: false,
    isCommissioner: false,
    activeGroup: null,
    isGroupCommissioner: false,
  }),
}));
