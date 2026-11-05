"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CreditCard } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/shared/money";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card as Panel, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatDay } from "@/lib/format";
import type { TransactionQuery } from "@/lib/schemas";

export function CardTransactions({ cardId }: { cardId: string }) {
  // Server-side card filter: the newest 10 purchases on this card, however far back they are.
  const recentQuery: TransactionQuery = {
    filters: { cardIds: [cardId] },
    sort: { id: "postedAt", desc: true },
    page: 0,
    pageSize: 10,
  };
  const query = useQuery({
    queryKey: ["transactions", recentQuery],
    queryFn: () => api.transactions(recentQuery),
  });
  const rows = query.data?.rows ?? [];

  return (
    <Panel className="gap-2">
      <CardHeader>
        <CardTitle>Recent card activity</CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/transactions">
              View all <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <ul className="divide-y" aria-busy="true" aria-label="Loading card activity">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-5 w-20" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <ErrorState title="Couldn't load card activity" error={query.error} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={CreditCard} title="No recent card activity" description="Purchases on this card will show up here." />
        ) : (
          <ul className="divide-y">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                >
                  {t.counterparty.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.counterparty}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDay(t.postedAt)} · {CATEGORY_LABELS[t.category]}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Money cents={t.amountCents} signDisplay="exceptZero" colorizeInflow className="text-sm font-medium" />
                  {t.status !== "completed" && <StatusBadge status={t.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Panel>
  );
}
