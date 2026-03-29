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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await loadProfile(session.user.id);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setActiveGroup(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setProfile, setActiveGroup, setIsLoading]);

  return null;
}
