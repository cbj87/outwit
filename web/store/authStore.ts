import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session } from "@supabase/supabase-js";
import type { Profile, Group } from "@shared/types";

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
      reset: () =>
        set({
          session: null,
          profile: null,
          isLoading: false,
          isCommissioner: false,
          activeGroup: null,
          isGroupCommissioner: false,
        }),
    }),
    {
      name: "outwit-auth",
      // Only persist the pieces needed to avoid the flash — never the session
      // itself (Supabase manages that in its own storage).
      partialize: (state) => ({
        profile: state.profile,
        activeGroup: state.activeGroup,
        isCommissioner: state.isCommissioner,
        isGroupCommissioner: state.isGroupCommissioner,
      }),
      // When restoring from cache, skip the loading spinner — we already have
      // enough data to render. AuthInitializer will refresh in the background.
      onRehydrateStorage: () => (state) => {
        if (state?.profile) {
          state.isLoading = false;
        }
      },
    }
  )
);
