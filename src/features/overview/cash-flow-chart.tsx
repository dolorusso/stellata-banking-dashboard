"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, LegendItem } from "@/components/shared/chart-card";
import { MoneyTooltip } from "@/components/shared/chart-tooltip";
import { Money } from "@/components/shared/money";
import { ChartContainer } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay, formatDayRange } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/schemas";

const IN = "var(--chart-1)";
const OUT = "var(--chart-2)";
const NET = "var(--foreground)";

const compactTick = (value: number) => formatMoney(Math.round(value), { compact: true });

export function CashFlowChart({ data }: { data: Overview["cashFlow"] }) {
  const rows = data.map((b) => ({ ...b, label: formatDay(b.start), out: -b.outCents }));

  return (
    <ChartCard
      title="Cash flow"
      description="Money in vs money out, excluding transfers between your accounts"
      legend={
        <div className="mb-3 flex flex-wrap gap-4">
          <LegendItem color={IN} label="Money in" />
          <LegendItem color={OUT} label="Money out" />
          <LegendItem color={NET} label="Net" shape="dot" />
        </div>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((b) => (
              <TableRow key={b.start}>
                <TableCell>{formatDayRange(b.start, b.end)}</TableCell>
                <TableCell className="text-right"><Money cents={b.inCents} /></TableCell>
                <TableCell className="text-right"><Money cents={-b.outCents} /></TableCell>
                <TableCell className="text-right"><Money cents={b.netCents} signDisplay="exceptZero" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer config={{}} className="aspect-auto h-64 w-full">
        <ComposedChart data={rows} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis tickFormatter={compactTick} tickLine={false} axisLine={false} width={56} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const datum = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !datum) return null;
              return (
                <MoneyTooltip
                  title={formatDayRange(datum.start, datum.end)}
                  rows={[
                    { label: "Money in", cents: datum.inCents, color: IN },
                    { label: "Money out", cents: -datum.outCents, color: OUT },
                    { label: "Net", cents: datum.netCents, color: NET },
                  ]}
                />
              );
            }}
          />
          {/* Animations off: this chart refetches on range change and while transfers settle. */}
          <Bar dataKey="inCents" name="Money in" stackId="flow" fill={IN} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="out" name="Money out" stackId="flow" fill={OUT} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          {/* Net per period as markers, not a line: buckets are discrete, a line would imply continuity. */}
          <Line
            dataKey="netCents"
            name="Net"
            stroke="none"
            dot={{ r: 4, fill: NET, stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: NET, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  );
}
