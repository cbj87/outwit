"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { Profile, Group } from "@shared/types";

export function AuthInitializer() {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setActiveGroup = useAuthStore((s) => s.setActiveGroup);
  const setIsLoading = useAuthStore((s) => s.setIsLoading);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(userId: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!profile) return;
      setProfile(profile as Profile);
      if ((profile as Profile).active_group_id) {
        const { data: group } = await supabase
          .from("groups")
          .select("*")
          .eq("id", (profile as Profile).active_group_id)
          .single();
        if (group) setActiveGroup(group as Group);
      }
    }

    // onAuthStateChange fires INITIAL_SESSION on setup — no need for a
    // separate getSession() call, which would compete for the same Web Lock
    // and cause "lock stolen" errors under React Strict Mode.
    //
    // IMPORTANT: The callback must NOT be async and must NOT call supabase.from()
    // directly. onAuthStateChange holds the Navigator Lock while calling this
    // callback; supabase.from() → getSession() → re-acquires the same lock → deadlock.
    // Deferring with setTimeout lets the lock release before the DB call runs.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        setTimeout(async () => {
          await loadProfile(session.user.id);
          setIsLoading(false);
        }, 0);
      } else {
        setProfile(null);
        setActiveGroup(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setProfile, setActiveGroup, setIsLoading]);

  return null;
}
