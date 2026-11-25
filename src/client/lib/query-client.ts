import { QueryClient } from "@tanstack/react-query";
import { SessionExpiredError } from "./api";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => !(error instanceof SessionExpiredError) && count < 2,
      },
      mutations: { retry: false },
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
