import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatPercentChange } from "@/lib/format";
import { formatMoney, percentChange } from "@/lib/money";
import type { Overview } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Delta = { ratio: number | null; upIsGood: boolean };

function DeltaBadge({ ratio, upIsGood, periodLabel }: Delta & { periodLabel: string }) {
  if (ratio === null) return <span className="text-xs text-muted-foreground">No prior period to compare</span>;
  const flat = Math.abs(ratio) < 0.005;
  const good = flat ? null : ratio > 0 === upIsGood;
  const Icon = flat ? Minus : ratio > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          good === true && "text-positive",
          good === false && "text-negative",
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {formatPercentChange(ratio)}
      </span>
      vs prior {periodLabel}
    </span>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <Card className="gap-1.5 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      {children}
    </Card>
  );
}

export function KpiTiles({ overview, periodLabel }: { overview: Overview; periodLabel: string }) {
  const { flows, previousFlows: prev, monthlyBurnCents, runwayMonths } = overview;
  const change = (current: number, previous: number | undefined) =>
    previous === undefined ? null : percentChange(current, previous);

  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Tile label="Money in" value={formatMoney(flows.inCents)}>
        <DeltaBadge ratio={change(flows.inCents, prev?.inCents)} upIsGood periodLabel={periodLabel} />
      </Tile>
      <Tile label="Money out" value={formatMoney(flows.outCents)}>
        <DeltaBadge ratio={change(flows.outCents, prev?.outCents)} upIsGood={false} periodLabel={periodLabel} />
      </Tile>
      <Tile label="Net cash flow" value={formatMoney(flows.netCents, { signDisplay: "exceptZero" })}>
        <DeltaBadge ratio={change(flows.netCents, prev?.netCents)} upIsGood periodLabel={periodLabel} />
      </Tile>
      <Tile
        label="Runway"
        value={runwayMonths === null ? "Cash-flow positive" : `${runwayMonths.toFixed(1)} months`}
      >
        <span className="text-xs text-muted-foreground">
          {monthlyBurnCents > 0
            ? `Net burn ${formatMoney(monthlyBurnCents, { compact: true })} / month`
            : "No net burn in this period"}
        </span>
      </Tile>
    </section>
  );
}
