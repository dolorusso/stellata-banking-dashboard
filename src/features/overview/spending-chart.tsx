"use client";

import { Bar, BarChart, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/shared/chart-card";
import { MoneyTooltip } from "@/components/shared/chart-tooltip";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/states";
import { ChartContainer } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/schemas";

// One series (spend per category) → one color. Bar length carries the magnitude.
const FILL = "var(--chart-accent)";
const BAR_PX = 32;

export function SpendingChart({ data, totalOutCents }: { data: Overview["spending"]; totalOutCents: number }) {
  const rows = data.map((d) => ({ ...d, label: CATEGORY_LABELS[d.category] }));
  const share = (cents: number) => (totalOutCents > 0 ? Math.round((cents / totalOutCents) * 100) : 0);

  return (
    <ChartCard
      title="Spending by category"
      description="Top categories by money out in this period"
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.category}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right"><Money cents={r.cents} /></TableCell>
                <TableCell className="amount text-right">{share(r.cents)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="No spending in this period" />
      ) : (
        <>
        <p className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{rows[0]!.label}</span> is {share(rows[0]!.cents)}% of the{" "}
          <span className="font-medium text-foreground">{formatMoney(totalOutCents)}</span> that went out.
          {rows.length > 1 && ` The top ${rows.length} categories cover ${share(rows.reduce((s, r) => s + r.cents, 0))}%.`}
        </p>
        <ChartContainer config={{}} className="aspect-auto w-full" style={{ height: rows.length * BAR_PX + 8 }}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={136} tick={{ fill: "var(--foreground)" }} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !datum) return null;
                return (
                  <MoneyTooltip
                    title={`${datum.label} · ${share(datum.cents)}% of spend`}
                    rows={[{ label: "Spent", cents: datum.cents, color: FILL }]}
                  />
                );
              }}
            />
            <Bar dataKey="cents" fill={FILL} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              <LabelList
                dataKey="cents"
                position="right"
                className="amount fill-muted-foreground text-xs"
                formatter={(value) => (typeof value === "number" ? formatMoney(value, { compact: true }) : "")}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        </>
      )}
    </ChartCard>
  );
}
