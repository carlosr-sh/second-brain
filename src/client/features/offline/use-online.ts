import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * True while the app can reach the server. Backed by TanStack's onlineManager,
 * which follows the browser's online/offline events AND failed requests
 * (see lib/connectivity.ts) — Wi-Fi without internet also counts as offline.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}
