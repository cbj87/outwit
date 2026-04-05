"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState } from "react";
import { AuthInitializer } from "./AuthInitializer";
import { SpoilerOnboardingModal } from "./SpoilerOnboardingModal";
import { NotificationOnboardingModal } from "./NotificationOnboardingModal";

// Created at module level — on the server, window is undefined so storage is a no-op.
// In the browser bundle this runs with window.localStorage, giving real persistence.
const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
});

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Show stale data immediately; fetch in background after 5 min
            staleTime: 1000 * 60 * 5,
            // Keep data in memory/storage for 24 h so it survives page reloads
            gcTime: TWENTY_FOUR_HOURS,
            retry: 1,
          },
        },
      })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: TWENTY_FOUR_HOURS }}
    >
      <AuthInitializer />
      <SpoilerOnboardingModal />
      <NotificationOnboardingModal />
      {children}
    </PersistQueryClientProvider>
  );
}
