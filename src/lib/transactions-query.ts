import { CATEGORY_LABELS } from "./categories";
import { centsToDecimalString } from "./money";
import type { Account, Transaction, TransactionFilters, TransactionQuery, TransactionSort } from "./schemas";

export function filterTransactions(transactions: readonly Transaction[], filters: TransactionFilters): Transaction[] {
  const q = filters.q?.toLowerCase();
  const categories = filters.categories?.length ? new Set(filters.categories) : null;
  const statuses = filters.statuses?.length ? new Set(filters.statuses) : null;
  const accounts = filters.accountIds?.length ? new Set(filters.accountIds) : null;
  const cards = filters.cardIds?.length ? new Set(filters.cardIds) : null;

  return transactions.filter((t) => {
    const day = t.postedAt.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (categories && !categories.has(t.category)) return false;
    if (statuses && !statuses.has(t.status)) return false;
    if (accounts && !accounts.has(t.accountId)) return false;
    if (cards && (t.cardId === null || !cards.has(t.cardId))) return false;
    const abs = Math.abs(t.amountCents);
    if (filters.minCents !== undefined && abs < filters.minCents) return false;
    if (filters.maxCents !== undefined && abs > filters.maxCents) return false;
    if (q) {
      const haystack = `${t.description} ${t.counterparty} ${t.reference} ${t.memo ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

const comparators: Record<TransactionSort["id"], (a: Transaction, b: Transaction) => number> = {
  postedAt: (a, b) => a.postedAt.localeCompare(b.postedAt),
  amountCents: (a, b) => a.amountCents - b.amountCents,
  counterparty: (a, b) => a.counterparty.localeCompare(b.counterparty),
  category: (a, b) => CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]),
  status: (a, b) => a.status.localeCompare(b.status),
};

export function sortTransactions(transactions: readonly Transaction[], sort: TransactionSort): Transaction[] {
  const compare = comparators[sort.id];
  // Tie-break on date (newest first) then id so pagination is stable.
  return transactions.toSorted(
    (a, b) => (sort.desc ? -compare(a, b) : compare(a, b)) || b.postedAt.localeCompare(a.postedAt) || a.id.localeCompare(b.id),
  );
}

export function queryTransactions(transactions: readonly Transaction[], query: TransactionQuery) {
  const sorted = sortTransactions(filterTransactions(transactions, query.filters), query.sort);
  const start = query.page * query.pageSize;
  return { rows: sorted.slice(start, start + query.pageSize), total: sorted.length };
}

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function csvCell(value: string): string {
  // Quote when needed; neutralize spreadsheet formula injection (=, +, -, @),
  // but leave plain numbers like "-12.50" alone so amounts stay numeric.
  const safe = /^[=+\-@]/.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function transactionsToCsv(transactions: readonly Transaction[], accounts: readonly Account[]): string {
  const accountName = new Map(accounts.map((a) => [a.id, `${a.name} ••${a.last4}`]));
  const header = ["Date", "Description", "Counterparty", "Account", "Category", "Method", "Status", "Amount (USD)", "Reference", "Memo"];
  const rows = transactions.map((t) => [
    t.postedAt,
    t.description,
    t.counterparty,
    accountName.get(t.accountId) ?? t.accountId,
    CATEGORY_LABELS[t.category],
    t.method.toUpperCase(),
    t.status,
    centsToDecimalString(t.amountCents),
    t.reference,
    t.memo ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
