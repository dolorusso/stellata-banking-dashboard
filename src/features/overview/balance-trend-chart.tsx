"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/shared/chart-card";
import { MoneyTooltip } from "@/components/shared/chart-tooltip";
import { Money } from "@/components/shared/money";
import { ChartContainer } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/schemas";

const STROKE = "var(--chart-accent)";

export function BalanceTrendChart({ data }: { data: Overview["balanceTrend"] }) {
  const rows = data.map((d) => ({ ...d, label: formatDay(d.date) }));

  return (
    <ChartCard
      title="Balance trend"
      description="End-of-day total across all accounts"
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.toReversed().map((d) => (
              <TableRow key={d.date}>
                <TableCell>{formatDay(d.date, "medium")}</TableCell>
                <TableCell className="text-right"><Money cents={d.balanceCents} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer config={{}} className="aspect-auto h-64 w-full">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
          <YAxis
            // Zoom to the data with round ticks: the trend is the story, not the distance from zero.
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatMoney(Math.round(v), { compact: true })}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const datum = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !datum) return null;
              return (
                <MoneyTooltip title={formatDay(datum.date, "medium")} rows={[{ label: "Total balance", cents: datum.balanceCents, color: STROKE }]} />
              );
            }}
          />
          <Area
            dataKey="balanceCents"
            type="linear"
            stroke={STROKE}
            strokeWidth={2}
            fill={STROKE}
            fillOpacity={0.1}
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: STROKE }}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}
