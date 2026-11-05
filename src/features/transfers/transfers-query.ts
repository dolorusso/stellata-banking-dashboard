import { queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { pollWhileSettling } from "@/lib/queries";

/** User transfers, polled while any of them is about to settle. */
export const transfersQuery = queryOptions({
  queryKey: ["transfers"],
  queryFn: api.transfers,
  refetchInterval: (query) => pollWhileSettling(query.state.data),
});

/** Current time, ticking every second only while `active` (for settle countdowns). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    // Sync immediately on activation: the mount-time value can be seconds stale
    // (e.g. a list mounted before the transfer was sent), which inflated countdowns.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);
  return now;
}

export function secondsUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 1_000));
}
