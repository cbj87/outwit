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

const swSelf = self as any; // eslint-disable-line @typescript-eslint/no-explicit-any

swSelf.addEventListener("push", (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!event.data) return;
  const data = event.data.json() as { title: string; body: string; url?: string };
  event.waitUntil(
    swSelf.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    })
  );
});

swSelf.addEventListener("notificationclick", (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";
  event.waitUntil(
    swSelf.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const existing = clientList.find((c) => "focus" in c);
        if (existing) {
          existing.navigate(url);
          return existing.focus();
        }
        return swSelf.clients.openWindow(url);
      })
  );
});
