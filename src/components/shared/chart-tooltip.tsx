import { formatMoney } from "@/lib/money";

export type TooltipRow = { label: string; cents: number; color: string; shape?: "line" | "rect" };

/**
 * Chart tooltip body: the value leads (strong), the series name follows, keyed
 * with a short stroke of the series color. Values are integer cents.
 */
export function MoneyTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="mb-1.5 font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="amount font-semibold text-foreground">{formatMoney(row.cents)}</span>
            <span className="ml-auto pl-3 text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
