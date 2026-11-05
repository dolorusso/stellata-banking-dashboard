"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api-client";
import { formatDay } from "@/lib/format";
import { pollWhileSettling } from "@/lib/queries";
import type { OverviewRange } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { BalanceSummary } from "./balance-summary";
import { BalanceTrendChart } from "./balance-trend-chart";
import { CashFlowChart } from "./cash-flow-chart";
import { KpiTiles } from "./kpi-tiles";
import { OverviewSkeleton } from "./overview-skeleton";
import { RecentActivity } from "./recent-activity";
import { SpendingChart } from "./spending-chart";

const RANGE_OPTIONS: { value: OverviewRange; label: string; period: string }[] = [
  { value: "30d", label: "30D", period: "30 days" },
  { value: "90d", label: "90D", period: "90 days" },
  { value: "180d", label: "6M", period: "6 months" },
];

export function OverviewView() {
  const [range, setRange] = useState<OverviewRange>("90d");
  const query = useQuery({
    queryKey: ["overview", range],
    queryFn: () => api.overview(range),
    // Refetch keeps the frame: hold the previous render instead of flashing skeletons.
    placeholderData: keepPreviousData,
    // A just-sent transfer shows up in recent activity as pending: keep balances live until it settles.
    refetchInterval: (q) => pollWhileSettling(q.state.data?.recent),
  });
  const option = RANGE_OPTIONS.find((o) => o.value === range)!;
  const data = query.data;

  return (
    <>
      <PageHeader
        title="Overview"
        description={data ? `${formatDay(data.from, "medium")} – ${formatDay(data.to, "medium")}` : "Your cash position across every account"}
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={range}
            onValueChange={(next) => next && setRange(next as OverviewRange)}
            aria-label="Date range"
          >
            {RANGE_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} aria-label={`Last ${o.period}`} className="px-3">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      {query.isPending ? (
        <OverviewSkeleton />
      ) : query.isError && !data ? (
        <ErrorState title="Couldn't load your overview" error={query.error} onRetry={() => query.refetch()} />
      ) : data ? (
        <div
          className={cn("space-y-6 transition-opacity", query.isPlaceholderData && "opacity-60")}
          aria-busy={query.isFetching}
        >
          <BalanceSummary
            accounts={data.accounts}
            totalBalanceCents={data.totalBalanceCents}
            pendingOutCents={data.pendingOutCents}
          />
          <KpiTiles overview={data} periodLabel={option.period} />
          <div className="grid gap-4 xl:grid-cols-2">
            <CashFlowChart data={data.cashFlow} />
            <BalanceTrendChart data={data.balanceTrend} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SpendingChart data={data.spending} totalOutCents={data.flows.outCents} />
            <RecentActivity transactions={data.recent} />
          </div>
        </div>
      ) : null}
    </>
  );
}
