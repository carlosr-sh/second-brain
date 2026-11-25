import { MutationCache, QueryClient } from "@tanstack/react-query";
import { OFFLINE_MAX_AGE } from "@/features/offline/offline-store";
import { NetworkError, SessionExpiredError } from "./api";
import { toastError } from "./toast-error";

export function createQueryClient() {
  return new QueryClient({
    // Safety net: a write that failed for lack of network always tells the
    // user, even if its caller has no onError (same toast id → shown once).
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof NetworkError) toastError(error, "");
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Must be >= the persister maxAge, or entries are dropped from the
        // offline copy before they expire.
        gcTime: OFFLINE_MAX_AGE,
        refetchOnWindowFocus: true,
        retry: (count, error) => !(error instanceof SessionExpiredError) && count < 2,
      },
      // "always": an offline write fails immediately (NetworkError) instead of
      // being silently paused in memory — the app is read-only offline.
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

/** Centralized query keys: one place to see (and invalidate) cached data. */
export const queryKeys = {
  me: ["me"] as const,
  settings: ["settings"] as const,
  systemStatus: ["system", "status"] as const,
  auditLogs: ["audit-logs"] as const,
  inbox: (status: string) => ["inbox", "list", status] as const,
  inboxAll: ["inbox"] as const,
  inboxCount: ["inbox", "count"] as const,
};
