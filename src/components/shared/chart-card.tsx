"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: string;
  description?: string;
  /** Legend row, rendered above the plot. */
  legend?: ReactNode;
  /** Table twin of the chart: the accessible, tooltip-free way to read every value. */
  table: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ChartCard({ title, description, legend, table, children, className }: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={view}
            onValueChange={(next) => next && setView(next as "chart" | "table")}
            aria-label={`${title} view`}
          >
            <ToggleGroupItem value="chart" aria-label="Chart view">
              <BarChart3 aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <Table2 aria-hidden="true" />
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {view === "chart" ? (
          <>
            {legend}
            {children}
          </>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border">{table}</div>
        )}
      </CardContent>
    </Card>
  );
}

const LEGEND_SHAPES = {
  rect: "size-2.5 rounded-[3px]",
  line: "h-0.5 w-3.5 rounded-full",
  dot: "size-2 rounded-full",
};

/** Legend keys mirror the mark: rect for bars/areas, line for lines, dot for markers. */
export function LegendItem({ color, label, shape = "rect" }: { color: string; label: string; shape?: keyof typeof LEGEND_SHAPES }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn("shrink-0", LEGEND_SHAPES[shape])}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
