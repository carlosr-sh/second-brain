import { useCallback, useEffect } from "react";
import { useSettings, useUpdateSetting } from "@/features/settings/hooks";

const KEY = "sb.sidebarCollapsed";

function readCached(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Sidebar collapsed state: server setting, mirrored locally for a flicker-free first paint. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const settings = useSettings();
  const update = useUpdateSetting("layout.sidebarCollapsed");
  const collapsed = settings.isPlaceholderData ? readCached() : (settings.data?.["layout.sidebarCollapsed"] ?? false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const { mutate } = update;
  const toggle = useCallback(() => mutate(!collapsed), [mutate, collapsed]);
  return [collapsed, toggle];
}
