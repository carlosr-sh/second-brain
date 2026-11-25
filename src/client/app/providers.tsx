import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, persistQueryClientSave, type PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { useEffect, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CACHE_BUSTER, isOfflineEnabled, OFFLINE_MAX_AGE, persister, shouldPersistQuery } from "@/features/offline/offline-store";
import { SessionGuard } from "@/features/session/session-guard";
import { ThemeProvider } from "@/features/theme/theme-provider";
import { UiStateProvider } from "./ui-state";

/**
 * With offline enabled on this device, the query cache is restored from
 * IndexedDB on start and saved back (throttled) as data changes. Writes are
 * never persisted: the app is read-only offline.
 */
const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: OFFLINE_MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery, shouldDehydrateMutation: () => false },
};

/**
 * Saves are throttled (1 s). On a phone the app is often backgrounded or
 * closed right after opening something: save NOW when that happens, or the
 * last screen would never make it to the offline copy.
 */
function useSaveOnHide(queryClient: QueryClient, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const save = () => void persistQueryClientSave({ queryClient, ...persistOptions }).catch(() => {});
    const onVisibility = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
    };
  }, [queryClient, enabled]);
}

function QueryProvider({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  const enabled = isOfflineEnabled();
  useSaveOnHide(queryClient, enabled);
  if (!enabled) return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      // The saved copy may predate the last change (it is written at most once
      // per second): never trust it as fresh. Show it at once, then refetch —
      // offline, the refetch just stays paused.
      onSuccess={() => void queryClient.invalidateQueries()}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export function Providers({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryProvider queryClient={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <UiStateProvider>
            <SessionGuard>{children}</SessionGuard>
          </UiStateProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
