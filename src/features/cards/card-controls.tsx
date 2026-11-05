"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Snowflake } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { Card as Panel, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { setCardStatus } from "@/lib/demo-state";
import { formatMoney, sumCents } from "@/lib/money";
import { accountsQuery } from "@/lib/queries";
import type { Card, CardStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const CARDS_KEY = ["cards"] as const;

function SpendMeter({ spent, limit }: { spent: number; limit: number }) {
  const ratio = limit > 0 ? spent / limit : 0;
  const tone = ratio > 1 ? "bg-negative" : ratio > 0.8 ? "bg-warning" : "bg-chart-accent";
  const remaining = sumCents([limit, -spent]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Spent this month</span>
        <span>
          <span className="amount font-semibold">{formatMoney(spent)}</span>
          <span className="text-muted-foreground"> of {formatMoney(limit)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label="Monthly card spend"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(spent, limit)}
        aria-valuetext={`${formatMoney(spent)} of ${formatMoney(limit)} spent`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {remaining >= 0
          ? `${formatMoney(remaining)} left · ${Math.round(ratio * 100)}% of the monthly limit used`
          : `${formatMoney(-remaining)} over the monthly limit`}
      </p>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export function CardControls({ card }: { card: Card }) {
  const id = useId();
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery);
  const account = accounts.data?.find((a) => a.id === card.accountId);
  const frozen = card.status === "frozen";

  const mutation = useMutation({
    mutationFn: (status: CardStatus) => api.updateCard(card.id, status),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: CARDS_KEY });
      const previous = queryClient.getQueryData<Card[]>(CARDS_KEY);
      queryClient.setQueryData<Card[]>(CARDS_KEY, (cards) =>
        cards?.map((c) => (c.id === card.id ? { ...c, status } : c)),
      );
      return { previous };
    },
    onError: (error, _status, context) => {
      queryClient.setQueryData(CARDS_KEY, context?.previous);
      toast.error(error instanceof Error ? error.message : "Couldn't update the card");
    },
    onSuccess: (updated) => {
      setCardStatus(updated.id, updated.status); // persist in the client-held demo state
      toast.success(updated.status === "frozen" ? "Card frozen" : "Card unfrozen");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CARDS_KEY }),
  });

  return (
    <Panel className="w-full gap-4">
      <CardHeader>
        <CardTitle>Card controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor={`${id}-freeze`} className="gap-1.5">
              <Snowflake className="size-4 text-muted-foreground" aria-hidden="true" />
              Freeze card
            </Label>
            <p id={`${id}-freeze-desc`} className="text-sm text-muted-foreground">
              Frozen cards decline new purchases. Recurring charges will also be declined.
            </p>
          </div>
          <Switch
            id={`${id}-freeze`}
            checked={frozen}
            disabled={mutation.isPending}
            aria-describedby={`${id}-freeze-desc`}
            onCheckedChange={(checked) => mutation.mutate(checked ? "frozen" : "active")}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {mutation.isPending ? "Updating card…" : frozen ? "Card is frozen" : "Card is active"}
        </p>

        <SpendMeter spent={card.spentThisMonthCents} limit={card.monthlyLimitCents} />

        <Separator />

        <dl className="divide-y">
          <Fact label="Status">{frozen ? "Frozen" : "Active"}</Fact>
          <Fact label="Linked account">{account ? `${account.name} ••${account.last4}` : "—"}</Fact>
          <Fact label="Type">Virtual debit</Fact>
          <Fact label="Expires"><span className="amount">{card.expiry}</span></Fact>
          <Fact label="Monthly limit">{formatMoney(card.monthlyLimitCents)}</Fact>
        </dl>
      </CardContent>
    </Panel>
  );
}
