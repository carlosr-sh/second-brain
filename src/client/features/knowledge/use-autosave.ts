import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Debounced autosave for any document (notes, journal).
 * Changes are merged and sent after `delay` ms of inactivity; pending changes
 * are flushed when the key changes, on unmount, and when the tab is hidden or
 * closed (with `keepalive` so the browser finishes the request after unload).
 *
 * `send` is kept in a ref: its identity may change every render, and depending
 * on it would re-run the cleanup effect (and flush) on every render.
 */
export function useAutosave<P extends object>(key: string, send: (patch: P, opts: { keepalive: boolean }) => Promise<unknown>, delay = 700) {
  const sendRef = useRef(send);
  sendRef.current = send;
  const pending = useRef<Partial<P>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const flush = useCallback((opts?: { unloading?: boolean }) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setStatus("saving");
    sendRef
      .current(patch as P, { keepalive: opts?.unloading === true })
      .then(() => setStatus((s) => (s === "saving" ? "saved" : s)))
      .catch(() => {
        pending.current = { ...patch, ...pending.current }; // keep for retry
        setStatus("error");
      });
  }, []);

  const queue = useCallback(
    (patch: Partial<P>) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(), delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush({ unloading: true });
    const onPageHide = () => flush({ unloading: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(); // key switched / unmounted
    };
  }, [flush, key]);

  return { queue, flush, status };
}
