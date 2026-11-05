import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatDay } from "@/lib/format";
import type { Transaction } from "@/lib/schemas";

export function RecentActivity({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/transactions">
              View all <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {transactions.map((t) => (
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
      </CardContent>
    </Card>
  );
}
