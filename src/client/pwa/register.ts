import { toast } from "sonner";

/**
 * Registers the service worker (production only). Loaded with a dynamic
 * import after the first render, so it never weighs on the initial bundle.
 *
 * Update flow ("prompt"): a new deploy installs a new SW in the background;
 * it only takes over when the user clicks "Atualizar" — a page never runs
 * half old / half new code in the middle of an edit.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const { registerSW } = await import("virtual:pwa-register");

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("Nova versão disponível", {
        id: "sw-update",
        duration: Number.POSITIVE_INFINITY,
        action: { label: "Atualizar", onClick: () => void updateSW(true) },
      });
    },
    onOfflineReady() {
      toast.success("Pronto para abrir sem internet", { id: "sw-offline-ready" });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Look for a new version whenever the app comes back to the foreground
      // (installed apps can stay open for days).
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && navigator.onLine) void registration.update().catch(() => {});
      });
    },
  });
}
