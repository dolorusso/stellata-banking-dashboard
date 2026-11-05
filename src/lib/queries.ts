/**
 * Shared TanStack Query definitions. Keys live next to their fetchers so every
 * caller (and every invalidation) uses the same identity.
 */
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api-client";

export const accountsQuery = queryOptions({ queryKey: ["accounts"], queryFn: api.accounts });

/** Saved payees are static demo data. */
export const payeesQuery = queryOptions({ queryKey: ["payees"], queryFn: api.payees, staleTime: Infinity });

/** How often to refetch while something is about to settle. */
export const SETTLEMENT_POLL_MS = 2_000;
const POLL_WINDOW_MS = 5 * 60_000;

/**
 * refetchInterval helper: poll only while an item is pending and due to settle
 * soon (user transfers settle in seconds; seeded card auths take days).
 */
export function pollWhileSettling(items: ReadonlyArray<{ status: string; settlesAt: string | null }> | undefined) {
  const now = Date.now();
  const soon = items?.some(
    (item) => item.status === "pending" && item.settlesAt !== null && Date.parse(item.settlesAt) - now < POLL_WINDOW_MS,
  );
  return soon ? SETTLEMENT_POLL_MS : false;
}
