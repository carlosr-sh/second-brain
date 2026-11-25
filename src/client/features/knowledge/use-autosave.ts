import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateNoteInput } from "@shared/knowledge";
import { useSaveNote } from "./queries";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Debounced autosave: changes are merged and sent after `delay` ms of
 * inactivity; pending changes are flushed when the note changes, the
 * component unmounts or the tab is being hidden/closed.
 */
export function useAutosave(noteId: string, delay = 700) {
  // `mutate` is referentially stable; the mutation OBJECT is not (depending on it
  // would re-run the cleanup effect — and flush — on every render).
  const { mutate } = useSaveNote();
  const pending = useRef<UpdateNoteInput>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const flush = useCallback((opts?: { unloading?: boolean }) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setStatus("saving");
    mutate(
      { id: noteId, ...patch, keepalive: opts?.unloading === true },
      {
        onSuccess: () => setStatus((s) => (s === "saving" ? "saved" : s)),
        onError: () => {
          pending.current = { ...patch, ...pending.current }; // keep for retry
          setStatus("error");
        },
      },
    );
  }, [noteId, mutate]);

  const queue = useCallback(
    (patch: UpdateNoteInput) => {
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
      flush(); // note switched / unmounted
    };
  }, [flush]);

  return { queue, flush, status };
}
