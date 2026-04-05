import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { revision: string | null; url: string })[];
};

const sw = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // defaultCache uses stale-while-revalidate for most assets and
  // network-first for navigation requests — good balance for this app.
  runtimeCaching: defaultCache,
});

sw.addEventListeners();
