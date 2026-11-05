/**
 * Overview aggregations, computed server-side from the ledger.
 *
 * Money in/out excludes internal transfers (moving cash between your own
 * accounts is neither revenue nor spend) and failed transactions. Pending
 * transactions count: the money is already committed.
 */
import type { Ledger } from "./ledger";
import { HISTORY_DAYS } from "./seed";
import type { Category, Overview, OverviewRange, Transaction } from "./schemas";

const DAY_MS = 86_400_000;
export const RANGE_DAYS: Record<OverviewRange, number> = { "30d": 30, "90d": 90, "180d": 180 };
/** Bucket width per range: daily, weekly, ~monthly. */
const BUCKET_DAYS: Record<OverviewRange, number> = { "30d": 1, "90d": 7, "180d": 30 };
const SPENDING_SLOTS = 6;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const counts = (t: Transaction) => t.status !== "failed" && t.category !== "transfer";

function flowTotals(transactions: readonly Transaction[]) {
  let inCents = 0;
  let outCents = 0;
  for (const t of transactions) {
    if (!counts(t)) continue;
    if (t.amountCents > 0) inCents += t.amountCents;
    else outCents -= t.amountCents;
  }
  return { inCents, outCents, netCents: inCents - outCents };
}

const inWindow = (transactions: readonly Transaction[], from: string, to: string) =>
  transactions.filter((t) => {
    const day = t.postedAt.slice(0, 10);
    return day >= from && day <= to;
  });

export function buildOverview(ledger: Ledger, range: OverviewRange): Overview {
  const days = RANGE_DAYS[range];
  const today = Date.parse(ledger.now.toISOString().slice(0, 10));
  const fromMs = today - (days - 1) * DAY_MS;
  const from = isoDay(fromMs);
  const to = isoDay(today);

  const window = inWindow(ledger.transactions, from, to);
  const flows = flowTotals(window);

  // The seed covers HISTORY_DAYS before today; compare only when fully covered.
  const previousFlows =
    days * 2 <= HISTORY_DAYS
      ? flowTotals(inWindow(ledger.transactions, isoDay(fromMs - days * DAY_MS), isoDay(fromMs - DAY_MS)))
      : null;

  const totalBalanceCents = ledger.accounts.reduce((sum, a) => sum + a.balanceCents, 0);
  const pendingOutCents = ledger.accounts.reduce((sum, a) => sum + a.pendingOutCents, 0);
  const monthlyBurnCents = flows.netCents < 0 ? Math.round((-flows.netCents * 30) / days) : 0;
  const runwayMonths = monthlyBurnCents > 0 ? totalBalanceCents / monthlyBurnCents : null;

  // Buckets are aligned to end today, so the last bar is always "now".
  const bucketDays = BUCKET_DAYS[range];
  const cashFlow: Overview["cashFlow"] = [];
  for (let end = today; end >= fromMs; end -= bucketDays * DAY_MS) {
    const start = Math.max(fromMs, end - (bucketDays - 1) * DAY_MS);
    cashFlow.unshift({ start: isoDay(start), end: isoDay(end), ...flowTotals(inWindow(window, isoDay(start), isoDay(end))) });
  }

  const byCategory = new Map<Category, number>();
  for (const t of window) {
    if (counts(t) && t.amountCents < 0) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) - t.amountCents);
  }
  const spending = [...byCategory]
    .map(([category, cents]) => ({ category, cents }))
    .toSorted((a, b) => b.cents - a.cents)
    .slice(0, SPENDING_SLOTS);

  // End-of-day total balance, walking back from the current balance.
  const balanceTrend: Overview["balanceTrend"] = [];
  let balance = totalBalanceCents;
  let cursor = 0; // ledger.transactions is newest first
  for (let day = today; day >= fromMs; day -= DAY_MS) {
    const dayIso = isoDay(day);
    while (cursor < ledger.transactions.length && ledger.transactions[cursor]!.postedAt.slice(0, 10) > dayIso) {
      const t = ledger.transactions[cursor]!;
      if (t.status !== "failed") balance -= t.amountCents;
      cursor += 1;
    }
    balanceTrend.unshift({ date: dayIso, balanceCents: balance });
  }

  return {
    range,
    from,
    to,
    accounts: ledger.accounts,
    totalBalanceCents,
    pendingOutCents,
    flows,
    previousFlows,
    monthlyBurnCents,
    runwayMonths,
    cashFlow,
    spending,
    balanceTrend,
    recent: ledger.transactions.slice(0, 6),
  };
}
