import Link from "next/link";
import { Briefcase, Landmark, Users, type LucideIcon } from "lucide-react";
import { HeroMoney } from "@/components/shared/money";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { Account, AccountKind } from "@/lib/schemas";

const ACCOUNT_ICONS: Record<AccountKind, LucideIcon> = {
  operating: Briefcase,
  payroll: Users,
  tax_reserve: Landmark,
};

export function BalanceSummary({
  accounts,
  totalBalanceCents,
  pendingOutCents,
}: {
  accounts: Account[];
  totalBalanceCents: number;
  pendingOutCents: number;
}) {
  return (
    <section aria-labelledby="total-balance" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex flex-col justify-center rounded-xl bg-brand p-6 text-sidebar-foreground dark:bg-sidebar dark:ring-1 dark:ring-sidebar-border">
        <h2 id="total-balance" className="text-sm font-medium text-sidebar-muted">
          Total balance
        </h2>
        <p className="mt-2 text-4xl sm:text-5xl">
          <HeroMoney cents={totalBalanceCents} className="[&>span]:text-sidebar-muted" />
        </p>
        <p className="mt-3 text-sm text-sidebar-muted">
          Across {accounts.length} accounts
          {pendingOutCents > 0 && <> · {formatMoney(pendingOutCents)} outgoing pending</>}
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {accounts.map((account) => {
          const Icon = ACCOUNT_ICONS[account.kind];
          const share = totalBalanceCents > 0 ? (account.balanceCents / totalBalanceCents) * 100 : 0;
          return (
            <li key={account.id}>
              <Card className="h-full gap-0 p-0 transition-colors hover:bg-accent/40">
                <Link
                  href={`/transactions?account=${account.id}`}
                  className="flex h-full flex-col gap-4 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="grid size-7 place-items-center rounded-md bg-secondary text-secondary-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="font-medium text-foreground">{account.name}</span>
                    <span className="ml-auto font-mono text-xs">••{account.last4}</span>
                  </span>
                  <span className="mt-auto text-2xl font-semibold tracking-tight">{formatMoney(account.balanceCents)}</span>
                  <span className="space-y-1.5">
                    <span className="block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span className="block h-full rounded-full bg-chart-1" style={{ width: `${share}%` }} />
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {Math.round(share)}% of total
                      {account.pendingOutCents > 0 && ` · ${formatMoney(account.pendingOutCents)} pending`}
                    </span>
                  </span>
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
