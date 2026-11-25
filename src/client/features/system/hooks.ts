import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuditLogEntry, IntegrityCheckResponse, MeResponse, SystemStatusResponse } from "@shared/api";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useMe = () => useQuery({ queryKey: queryKeys.me, queryFn: () => api<MeResponse>("/me"), staleTime: Infinity });

export const useSystemStatus = () =>
  useQuery({ queryKey: queryKeys.systemStatus, queryFn: () => api<SystemStatusResponse>("/system/status") });

export const useAuditLogs = () =>
  useQuery({ queryKey: queryKeys.auditLogs, queryFn: () => api<AuditLogEntry[]>("/audit-logs?limit=20") });

export function useIntegrityCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<IntegrityCheckResponse>("/system/integrity-check", { method: "POST", json: {} }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.auditLogs }),
  });
}
