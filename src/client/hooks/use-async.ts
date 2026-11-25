import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

/** Minimal data loader for Phase 1 (replaced by a query cache in Phase 2). */
export function useAsync<T>(fn: () => Promise<T>): [AsyncState<T>, () => void] {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const run = useCallback(() => {
    setState({ status: "loading" });
    fn().then(
      (data) => setState({ status: "success", data }),
      (error: unknown) => setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) }),
    );
  }, [fn]);
  useEffect(run, [run]);
  return [state, run];
}
