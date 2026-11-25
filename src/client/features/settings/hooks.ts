import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SETTINGS, type SettingKey, type Settings } from "@shared/settings";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api<Settings>("/settings"),
    placeholderData: DEFAULT_SETTINGS,
    staleTime: Infinity,
  });
}

/** Optimistic update: UI changes immediately, rolls back if the server rejects. */
export function useUpdateSetting<K extends SettingKey>(key: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: Settings[K]) => api<Settings>(`/settings/${key}`, { method: "PUT", json: { value } }),
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey: queryKeys.settings });
      const previous = qc.getQueryData<Settings>(queryKeys.settings);
      qc.setQueryData<Settings>(queryKeys.settings, { ...(previous ?? DEFAULT_SETTINGS), [key]: value });
      return { previous };
    },
    onError: (_err, _value, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.settings, ctx.previous);
    },
    onSuccess: (data) => qc.setQueryData(queryKeys.settings, data),
  });
}
