"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginationState, SortingState, Updater } from "@tanstack/react-table";
import { Download, Loader2, Search, SearchX, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { CATEGORY_LABELS } from "@/lib/categories";
import { accountsQuery, pollWhileSettling } from "@/lib/queries";
import {
  CATEGORIES,
  TransactionSortSchema,
  type Category,
  type Transaction,
  type TransactionFilters,
  type TransactionQuery,
  type TransactionStatus,
} from "@/lib/schemas";
import { FacetFilter } from "./facet-filter";
import { AmountRangeFilter, DateRangeFilter, amountRangeLabel, dateRangeLabel } from "./range-filters";
import { TransactionDetail } from "./transaction-detail";
import { TransactionsTable } from "./transactions-table";
import { useDebouncedValue } from "./use-debounced-value";

const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));
const STATUS_OPTIONS: { value: TransactionStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];
const DEFAULT_SORTING: SortingState = [{ id: "postedAt", desc: true }];

const resolve = <T,>(updater: Updater<T>, previous: T): T =>
  typeof updater === "function" ? (updater as (old: T) => T)(previous) : updater;

function toApiSort(sorting: SortingState): TransactionQuery["sort"] {
  const parsed = TransactionSortSchema.safeParse(sorting[0]);
  return parsed.success ? parsed.data : { id: "postedAt", desc: true };
}

export function TransactionsView() {
  const searchParams = useSearchParams();
  const initialAccount = searchParams.get("account");

  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 250);
  const [filters, setFilters] = useState<Omit<TransactionFilters, "q">>(() =>
    initialAccount ? { accountIds: [initialAccount] } : {},
  );
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Any filter change returns to the first page.
  const updateFilters = (patch: Partial<TransactionFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };
  const onSearch = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const apiFilters: TransactionFilters = useMemo(() => ({ ...filters, ...(q ? { q } : {}) }), [filters, q]);
  const apiQuery: TransactionQuery = {
    filters: apiFilters,
    sort: toApiSort(sorting),
    page: pagination.pageIndex,
    pageSize: pagination.pageSize as TransactionQuery["pageSize"],
  };

  const accounts = useQuery(accountsQuery);
  const transactions = useQuery({
    queryKey: ["transactions", apiQuery],
    queryFn: () => api.transactions(apiQuery),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => pollWhileSettling(query.state.data?.rows),
  });

  const accountNames = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, `${a.name} ••${a.last4}`])),
    [accounts.data],
  );
  const accountOptions = useMemo(
    () => (accounts.data ?? []).map((a) => ({ value: a.id, label: a.name })),
    [accounts.data],
  );

  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const openDetail = useCallback((transaction: Transaction, trigger?: HTMLElement) => {
    setReturnFocusTo(trigger ?? null);
    setSelected(transaction);
    setDetailOpen(true);
  }, []);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.exportTransactions(apiFilters, apiQuery.sort);
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), {
        href: url,
        download: `stellata-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${transactions.data?.total ?? ""} transactions`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const chips = [
    ...(filters.categories ?? []).map((c) => ({
      key: `c-${c}`,
      label: CATEGORY_LABELS[c],
      remove: () => updateFilters({ categories: filters.categories?.filter((x) => x !== c) }),
    })),
    ...(filters.statuses ?? []).map((s) => ({
      key: `s-${s}`,
      label: STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s,
      remove: () => updateFilters({ statuses: filters.statuses?.filter((x) => x !== s) }),
    })),
    ...(filters.accountIds ?? []).map((id) => ({
      key: `a-${id}`,
      label: accountOptions.find((o) => o.value === id)?.label ?? "Account",
      remove: () => updateFilters({ accountIds: filters.accountIds?.filter((x) => x !== id) }),
    })),
  ];
  const dateLabel = dateRangeLabel(filters.from, filters.to);
  if (dateLabel) chips.push({ key: "date", label: dateLabel, remove: () => updateFilters({ from: undefined, to: undefined }) });
  const amountLabel = amountRangeLabel(filters.minCents, filters.maxCents);
  if (amountLabel) chips.push({ key: "amount", label: amountLabel, remove: () => updateFilters({ minCents: undefined, maxCents: undefined }) });

  const hasFilters = chips.length > 0 || search.length > 0;
  const clearAll = () => {
    setSearch("");
    setFilters({});
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const data = transactions.data;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search, filter and export activity across your accounts."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={exporting || !data || data.total === 0}>
            {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            Export CSV
          </Button>
        }
      />

      <Card className="gap-0 py-0">
        {/* Filters: one row above the content they scope */}
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search merchant, memo, reference…"
                aria-label="Search transactions"
                className="pl-8"
              />
            </div>
            <DateRangeFilter from={filters.from} to={filters.to} onChange={(range) => updateFilters(range)} />
            <FacetFilter<Category> label="Category" options={CATEGORY_OPTIONS} selected={filters.categories ?? []} onChange={(categories) => updateFilters({ categories })} />
            <FacetFilter<TransactionStatus> label="Status" options={STATUS_OPTIONS} selected={filters.statuses ?? []} onChange={(statuses) => updateFilters({ statuses })} />
            <FacetFilter label="Account" options={accountOptions} selected={filters.accountIds ?? []} onChange={(accountIds) => updateFilters({ accountIds })} />
            <AmountRangeFilter minCents={filters.minCents} maxCents={filters.maxCents} onChange={(range) => updateFilters(range)} />
          </div>
          {chips.length > 0 && (
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.remove}
                      aria-label={`Remove filter: ${chip.label}`}
                      className="rounded-full p-0.5 hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </Badge>
                </li>
              ))}
              <li>
                <Button variant="link" size="sm" onClick={clearAll} className="h-auto px-1">
                  Clear all
                </Button>
              </li>
            </ul>
          )}
        </div>

        {transactions.isError && !data ? (
          <ErrorState title="Couldn't load transactions" error={transactions.error} onRetry={() => transactions.refetch()} />
        ) : data && data.total === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No transactions match your filters"
            description="Try a wider date range or remove some filters."
            action={hasFilters ? <Button variant="outline" size="sm" onClick={clearAll}>Clear filters</Button> : undefined}
          />
        ) : (
          <TransactionsTable
            rows={data?.rows ?? EMPTY_ROWS}
            total={data?.total ?? 0}
            loading={transactions.isPending}
            dimmed={transactions.isPlaceholderData}
            sorting={sorting}
            onSortingChange={(updater) => {
              setSorting((prev) => resolve(updater, prev));
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            pagination={pagination}
            onPaginationChange={(updater) => setPagination((prev) => resolve(updater, prev))}
            accountNames={accountNames}
            onOpen={openDetail}
          />
        )}
      </Card>

      <TransactionDetail
        transaction={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        returnFocusTo={returnFocusTo}
        accountName={selected ? accountNames.get(selected.accountId) : undefined}
      />
    </>
  );
}

const EMPTY_ROWS: Transaction[] = [];
