"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

export function SpoilerOnboardingModal() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const queryClient = useQueryClient();

  const [show, setShow] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["season-config"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("season_config")
        .select("current_episode")
        .eq("id", 1)
        .single();
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isLoading || !userId || !profile) return;
    const key = `spoiler_onboarded_${userId}`;
    if (!localStorage.getItem(key)) setShow(true);
  }, [isLoading, userId, profile]);

  if (!show) return null;

  async function handleEnable() {
    if (!profile || !userId) return;
    setIsToggling(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ spoiler_protection: true, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (error) throw error;

      const currentEp = config?.current_episode ?? 0;
      if (currentEp > 0) {
        const rows = Array.from({ length: currentEp }, (_, i) => ({
          player_id: profile.id,
          episode_number: i + 1,
        }));
        await supabase
          .from("episode_seen_status")
          .upsert(rows, { onConflict: "player_id,episode_number" });
      }

      setProfile({ ...profile, spoiler_protection: true });
      queryClient.invalidateQueries({ queryKey: ["episode-seen-status"] });
    } finally {
      setIsToggling(false);
      localStorage.setItem(`spoiler_onboarded_${userId}`, "1");
      setShow(false);
      window.dispatchEvent(new CustomEvent("spoiler-onboarded"));
    }
  }

  function handleSkip() {
    localStorage.setItem(`spoiler_onboarded_${userId}`, "1");
    setShow(false);
    window.dispatchEvent(new CustomEvent("spoiler-onboarded"));
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={handleSkip}
      />
      <div
        className="fixed inset-x-4 z-50 rounded-2xl p-6 shadow-xl"
        style={{
          backgroundColor: "var(--color-surface)",
          top: "50%",
          transform: "translateY(-50%)",
          maxWidth: "360px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <div className="text-4xl text-center mb-3">🛡️</div>
        <h2
          className="text-lg font-black text-center mb-2"
          style={{ color: "var(--color-text)" }}
        >
          Spoiler Protection
        </h2>
        <p
          className="text-sm text-center mb-6 leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Hide standings until you've marked each episode as seen. You can change this any time in your profile.
        </p>
        <button
          onClick={handleEnable}
          disabled={isToggling}
          className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {isToggling ? "Enabling…" : "Turn on spoiler protection"}
        </button>
        <button
          onClick={handleSkip}
          className="w-full py-2 text-sm font-semibold"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Not now
        </button>
      </div>
    </>
  );
}
