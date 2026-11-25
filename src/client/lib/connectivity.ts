import { onlineManager } from "@tanstack/react-query";

/**
 * Connectivity = navigator.onLine AND "requests actually get through".
 *
 * navigator.onLine is only trustworthy when it says false (no interface /
 * airplane mode). With Wi-Fi but no internet, a weak signal or a captive
 * portal it stays true while every request fails. So a request that fails
 * at the network level also marks the app offline (TanStack's onlineManager:
 * queries then PAUSE and keep showing saved data instead of turning into
 * errors), and a light probe of /api/health detects when it comes back.
 */
const PROBE_MS = 15_000;
let probe: ReturnType<typeof setInterval> | null = null;

function stopProbe() {
  if (probe) clearInterval(probe);
  probe = null;
}

async function checkNow(): Promise<void> {
  try {
    const res = await fetch("/api/health", { cache: "no-store", redirect: "manual" });
    // Any HTTP answer (even an Access redirect) means the network is back.
    if (res.type === "opaqueredirect" || res.status > 0) markOnline();
  } catch {
    /* still down */
  }
}

export function markOffline(): void {
  if (!onlineManager.isOnline() && probe) return;
  onlineManager.setOnline(false);
  if (!probe && typeof window !== "undefined") probe = setInterval(() => void checkNow(), PROBE_MS);
}

export function markOnline(): void {
  stopProbe();
  if (!onlineManager.isOnline()) onlineManager.setOnline(true);
}

export function isOnline(): boolean {
  return onlineManager.isOnline();
}

if (typeof window !== "undefined") {
  // The OS says the network is back, or the app returns to the foreground: re-check now.
  window.addEventListener("online", () => void checkNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !onlineManager.isOnline()) void checkNow();
  });
}
