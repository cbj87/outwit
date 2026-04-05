import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

const sw = new Serwist({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  precacheEntries: (self as any).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

sw.addEventListeners();

self.addEventListener("push", (event: Event) => {
  const pushEvent = event as unknown as { data: { json(): { title: string; body: string; url?: string } } | null; waitUntil(p: Promise<unknown>): void };
  if (!pushEvent.data) return;
  const data = pushEvent.data.json();
  pushEvent.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event: Event) => {
  const ne = event as unknown as { notification: { close(): void; data: { url: string } }; waitUntil(p: Promise<unknown>): void };
  ne.notification.close();
  const url = ne.notification.data?.url ?? "/";
  ne.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find((c) => "focus" in c);
        if (existing) {
          (existing as WindowClient).navigate(url);
          return (existing as WindowClient).focus();
        }
        return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(url);
      })
  );
});
