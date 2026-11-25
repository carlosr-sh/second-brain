import type { UseQueryResult } from "@tanstack/react-query";

/**
 * Can an EDITOR be created from this query's data?
 *
 * Editors read their initial content once (they must not overwrite what the
 * user is typing), so they must never start from a copy that is about to be
 * replaced. A copy restored from the offline store is revalidated on start:
 * while that request is in flight, wait (skeleton). Offline the request is
 * paused (fetchStatus "paused") and the saved copy is used, read-only.
 */
export function isDocumentReady(q: Pick<UseQueryResult, "isPending" | "fetchStatus" | "isFetchedAfterMount">): boolean {
  if (q.isPending) return false;
  return !(q.fetchStatus === "fetching" && !q.isFetchedAfterMount);
}
