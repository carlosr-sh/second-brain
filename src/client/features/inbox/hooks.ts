import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInboxItemInput, InboxItem, InboxStatusFilter } from "@shared/inbox";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useInboxItems = (status: InboxStatusFilter) =>
  useQuery({ queryKey: queryKeys.inbox(status), queryFn: () => api<InboxItem[]>(`/inbox?status=${status}`) });

export const useInboxCount = () =>
  useQuery({ queryKey: queryKeys.inboxCount, queryFn: () => api<{ open: number }>("/inbox/count"), select: (d) => d.open });

function useInvalidateInbox() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.inboxAll });
}

export function useCaptureInbox() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: (input: CreateInboxItemInput) => api<InboxItem>("/inbox", { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}

export function useSetInboxProcessed() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: ({ id, processed }: { id: string; processed: boolean }) =>
      api<InboxItem>(`/inbox/${id}`, { method: "PATCH", json: { processed } }),
    onSuccess: invalidate,
  });
}

export function useTrashInbox() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/inbox/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
