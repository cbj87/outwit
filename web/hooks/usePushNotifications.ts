import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSubscribing, setIsSubscribing] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Check if this browser already has a subscription stored in the DB
  const { data: existingSubscription, isLoading } = useQuery({
    queryKey: ["push-subscription", userId],
    queryFn: async () => {
      if (!userId) return null;
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.getSubscription();
      if (!sub) return null;
      const supabase = createClient();
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      return data ?? null;
    },
    enabled: isSupported && !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const isSubscribed = !!existingSubscription;

  const subscribe = useCallback(async () => {
    if (!userId || !isSupported) return;
    setIsSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const sw = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("VAPID public key not configured");

      const sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      const json = sub.toJSON();
      const supabase = createClient();
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth_key: json.keys?.auth ?? "",
        },
        { onConflict: "user_id,endpoint" }
      );

      queryClient.invalidateQueries({ queryKey: ["push-subscription", userId] });
    } finally {
      setIsSubscribing(false);
    }
  }, [userId, isSupported, queryClient]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    setIsSubscribing(true);
    try {
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const supabase = createClient();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", endpoint);
      }
      queryClient.invalidateQueries({ queryKey: ["push-subscription", userId] });
    } finally {
      setIsSubscribing(false);
    }
  }, [userId, queryClient]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isSubscribing: isSubscribing || isLoading,
    subscribe,
    unsubscribe,
  };
}
