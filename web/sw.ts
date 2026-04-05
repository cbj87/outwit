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
