import { toast, type ExternalToast } from "sonner";
import { ApiError, NetworkError } from "./api";

/** Message for an error coming from api(): server message, offline notice or fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message;
  return fallback;
}

/**
 * Shows an error toast. Offline errors share one toast id, so a burst of
 * failed writes (or a local handler + the global one) shows ONE notice.
 */
export function toastError(err: unknown, fallback: string, opts?: ExternalToast): void {
  if (err instanceof NetworkError) {
    toast.error(err.message, { ...opts, id: "offline-write", description: "Você está offline. Conecte-se para editar." });
    return;
  }
  toast.error(errorMessage(err, fallback), opts);
}
