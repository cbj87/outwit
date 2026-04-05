"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationOnboardingModal() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);

  const { isSupported, permission, isSubscribing, subscribe } = usePushNotifications();

  const [show, setShow] = useState(false);

  // Check if we should show — only after spoiler onboarding is done
  const checkAndShow = useCallback(() => {
    if (!userId || !isSupported || permission !== "default") return;
    if (!localStorage.getItem(`spoiler_onboarded_${userId}`)) return;
    if (!localStorage.getItem(`notif_onboarded_${userId}`)) setShow(true);
  }, [userId, isSupported, permission]);

  useEffect(() => {
    if (isLoading || !userId || !profile) return;
    checkAndShow();
    // Also listen for spoiler modal being dismissed (in case it was showing first)
    window.addEventListener("spoiler-onboarded", checkAndShow);
    return () => window.removeEventListener("spoiler-onboarded", checkAndShow);
  }, [isLoading, userId, profile, checkAndShow]);

  if (!show) return null;

  async function handleEnable() {
    await subscribe();
    localStorage.setItem(`notif_onboarded_${userId}`, "1");
    setShow(false);
  }

  function handleSkip() {
    localStorage.setItem(`notif_onboarded_${userId}`, "1");
    setShow(false);
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
        <div className="text-4xl text-center mb-3">🔔</div>
        <h2
          className="text-lg font-black text-center mb-2"
          style={{ color: "var(--color-text)" }}
        >
          Episode Notifications
        </h2>
        <p
          className="text-sm text-center mb-6 leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Get notified when Lizzie finalizes a new episode&apos;s scores. You can change this any time in your profile.
        </p>
        <button
          onClick={handleEnable}
          disabled={isSubscribing}
          className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {isSubscribing ? "Enabling…" : "Turn on notifications"}
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
