"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Landmark, Send } from "lucide-react";
import { Money } from "@/components/shared/money";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/format";
import type { Account } from "@/lib/schemas";
import { METHOD_LABELS } from "./transfer-draft";
import { secondsUntil, transfersQuery, useNow } from "./transfers-query";

const MAX_ROWS = 8;

export function RecentTransfers({ accounts }: { accounts: readonly Account[] }) {
  const query = useQuery(transfersQuery);
  const transfers = query.data?.slice(0, MAX_ROWS) ?? [];
  const now = useNow(transfers.some((t) => t.status === "pending"));
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Account";

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Recent transfers</CardTitle>
        <CardDescription>Transfers you&apos;ve sent from Stellata.</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <ul className="space-y-3" aria-busy="true" aria-label="Loading transfers">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-9 flex-1" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <ErrorState title="Couldn't load transfers" error={query.error} onRetry={() => query.refetch()} />
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No transfers yet"
            description="Send an ACH or wire, or move money between accounts. It will show up here and settle in seconds."
          />
        ) : (
          // No aria-live here: the result step announces status changes, and this list's countdown ticks every second.
          <ul className="divide-y">
            {transfers.map((t) => {
              const seconds = t.status === "pending" ? secondsUntil(t.settlesAt, now) : null;
              const Icon = t.method === "internal" ? ArrowLeftRight : Landmark;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.destinationName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {METHOD_LABELS[t.method]} · from {accountName(t.fromAccountId)} · {formatDay(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Money cents={t.amountCents} className="text-sm font-medium" />
                    <span className="flex items-center gap-1.5">
                      {seconds !== null && (
                        <span className="amount text-xs text-muted-foreground">
                          <span className="sr-only">Settles in about </span>~{seconds}s
                        </span>
                      )}
                      <StatusBadge status={t.status} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
