import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneyProps = {
  cents: number;
  /** "exceptZero" shows +/- (use for signed transaction amounts). */
  signDisplay?: "auto" | "exceptZero" | "never";
  compact?: boolean;
  /** Tint inflows green. The +/- sign carries the meaning; color only reinforces it. */
  colorizeInflow?: boolean;
  className?: string;
};

/** Every amount in a table/list renders through this: tabular figures, one formatter. */
export function Money({ cents, signDisplay = "auto", compact, colorizeInflow, className }: MoneyProps) {
  return (
    <span className={cn("amount whitespace-nowrap", colorizeInflow && cents > 0 && "text-positive", className)}>
      {formatMoney(cents, { signDisplay, compact })}
    </span>
  );
}

/** Large standalone figure: proportional digits, cents de-emphasized. */
export function HeroMoney({ cents, className }: { cents: number; className?: string }) {
  const formatted = formatMoney(cents);
  const dot = formatted.lastIndexOf(".");
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      {formatted.slice(0, dot)}
      <span className="text-[0.55em] text-muted-foreground">{formatted.slice(dot)}</span>
    </span>
  );
}
