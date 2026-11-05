"use client";

import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatDay } from "@/lib/format";
import { PAGE_SIZES, type Transaction } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type ColumnMeta = { align?: "right"; className?: string };

// Server-side sorting & pagination: register the state features, no client row models.
const features = tableFeatures({ rowSortingFeature, rowPaginationFeature, columnMeta: {} as ColumnMeta });
const helper = createColumnHelper<typeof features, Transaction>();

type TransactionsTableProps = {
  rows: Transaction[];
  total: number;
  loading: boolean;
  dimmed: boolean;
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  pagination: PaginationState;
  onPaginationChange: (updater: Updater<PaginationState>) => void;
  accountNames: ReadonlyMap<string, string>;
  /** `trigger` is the element focus returns to when the detail closes. */
  onOpen: (transaction: Transaction, trigger?: HTMLElement) => void;
};

export function TransactionsTable({
  rows,
  total,
  loading,
  dimmed,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  accountNames,
  onOpen,
}: TransactionsTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("postedAt", {
          header: "Date",
          sortDescFirst: true,
          meta: { className: "w-28" },
          cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{formatDay(info.getValue(), "medium")}</span>,
        }),
        helper.accessor("counterparty", {
          header: "Description",
          cell: ({ row }) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(row.original, e.currentTarget);
              }}
              className="block max-w-72 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="block truncate font-medium">{row.original.counterparty}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.original.description}</span>
            </button>
          ),
        }),
        helper.accessor("accountId", {
          header: "Account",
          enableSorting: false,
          cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{accountNames.get(info.getValue()) ?? "—"}</span>,
        }),
        helper.accessor("category", {
          header: "Category",
          cell: (info) => <span className="whitespace-nowrap">{CATEGORY_LABELS[info.getValue()]}</span>,
        }),
        helper.accessor("status", {
          header: "Status",
          cell: (info) => <StatusBadge status={info.getValue()} />,
        }),
        helper.accessor("amountCents", {
          header: "Amount",
          sortDescFirst: true,
          meta: { align: "right" },
          cell: (info) => <Money cents={info.getValue()} signDisplay="exceptZero" colorizeInflow className="font-medium" />,
        }),
      ]),
    [accountNames, onOpen],
  );

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    rowCount: total,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
  });

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));
  const first = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const last = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div className={cn("transition-opacity", dimmed && "opacity-60")} aria-busy={dimmed || loading}>
      {/* Desktop: a real table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Transactions, sorted by {sorting[0]?.id ?? "date"}</caption>
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  const right = meta?.align === "right";
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn("h-10 px-4 text-left text-xs font-medium text-muted-foreground", right && "text-right", meta?.className)}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                            right && "flex-row-reverse",
                            sorted && "text-foreground",
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    // Mouse convenience: the whole row opens the detail. Focus returns to the row's button.
                    onClick={(e) => onOpen(row.original, e.currentTarget.querySelector("button") ?? undefined)}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                  >
                    {row.getAllCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn("px-4 py-2.5", cell.column.columnDef.meta?.align === "right" && "text-right")}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: the same rows as a tappable list */}
      <ul className="divide-y md:hidden">
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-5 w-20" />
              </li>
            ))
          : rows.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={(e) => onOpen(t, e.currentTarget)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.counterparty}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDay(t.postedAt)} · {CATEGORY_LABELS[t.category]}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Money cents={t.amountCents} signDisplay="exceptZero" colorizeInflow className="text-sm font-medium" />
                    {t.status !== "completed" && <StatusBadge status={t.status} />}
                  </span>
                </button>
              </li>
            ))}
      </ul>

      {/* Pagination */}
      <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground" aria-live="polite">
          {total === 0 ? "No results" : <>Showing <span className="amount">{first}–{last}</span> of <span className="amount">{total}</span></>}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger aria-label="Rows per page" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="amount px-1 text-muted-foreground">
            {pagination.pageIndex + 1} / {pageCount}
          </span>
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
