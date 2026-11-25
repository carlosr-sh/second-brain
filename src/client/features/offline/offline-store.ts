import type { Query } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { clear, createStore, del, get, set } from "idb-keyval";

/**
 * Offline READ cache: the TanStack Query cache persisted in IndexedDB.
 *
 * Why here and not in the service worker: one place holds personal data,
 * it stores exactly what the screens use (already validated JSON), and it
 * can be wiped with one call. The SW only caches the app shell.
 */
export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const PREF_KEY = "sb.offline"; // per-device preference (localStorage)

/** Caches every deploy invalidates: the shape of API data may have changed. */
export const CACHE_BUSTER = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

/**
 * Never persisted: search results (ephemeral, many keys), system/audit data
 * (operational, sensitive, useless offline) and the identity endpoint.
 */
const EXCLUDED_PREFIXES: readonly (readonly string[])[] = [["kb", "search"], ["system"], ["audit-logs"], ["me"]];

export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">): boolean {
  if (query.state.status !== "success") return false;
  const key = query.queryKey;
  return !EXCLUDED_PREFIXES.some((prefix) => prefix.every((part, i) => key[i] === part));
}

/**
 * Set once the copy is wiped (clear / sign out). Until the page reloads,
 * nothing may be written back — otherwise the in-memory cache (saved on
 * pagehide or by the throttled persister) would resurrect the deleted data.
 */
let writesSuspended = false;

const store = typeof indexedDB !== "undefined" ? createStore("second-brain-offline", "query-cache") : undefined;

export const persister = createAsyncStoragePersister({
  storage: store
    ? {
        getItem: (k: string) => get<string>(k, store).then((v) => v ?? null),
        setItem: (k: string, v: string) => (writesSuspended ? Promise.resolve() : set(k, v, store)),
        removeItem: (k: string) => del(k, store),
      }
    : undefined,
  key: "sb-query-cache",
  throttleTime: 1_000, // write at most every 1 s (plus an immediate save when the app is hidden)
});

export function isOfflineEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setOfflineEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode: preference not kept */
  }
}

/** Wipes every personal byte this device keeps for offline use. */
export async function clearOfflineData(): Promise<void> {
  writesSuspended = true; // callers reload or leave the page right after
  if (store) await clear(store);
}

/** Approximate size of the offline copy (bytes of the serialized cache). */
export async function offlineDataSize(): Promise<number> {
  if (!store) return 0;
  const raw = await get<string>("sb-query-cache", store);
  return raw ? new Blob([raw]).size : 0;
}
