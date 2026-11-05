"use client";

import { CalendarDays, ChevronDown, DollarSign } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDay } from "@/lib/format";
import { centsToDecimalString, formatMoney, parseMoneyToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

const PRESETS = [
  { label: "Last 7 days", from: () => daysAgoIso(6) },
  { label: "Last 30 days", from: () => daysAgoIso(29) },
  { label: "Last 90 days", from: () => daysAgoIso(89) },
  { label: "This month", from: () => `${todayIso().slice(0, 7)}-01` },
] as const;

export function dateRangeLabel(from?: string, to?: string) {
  if (from && to) return `${formatDay(from)} – ${formatDay(to)}`;
  if (from) return `Since ${formatDay(from)}`;
  if (to) return `Until ${formatDay(to)}`;
  return null;
}

export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const label = dateRangeLabel(from, to);
  const invalid = Boolean(from && to && from > to);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(!label && "border-dashed")}>
          <CalendarDays className="text-muted-foreground" aria-hidden="true" />
          {label ?? "Date"}
          <ChevronDown className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <ul className="p-1">
          {PRESETS.map((preset) => (
            <li key={preset.label}>
              <button
                type="button"
                className="w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => {
                  onChange({ from: preset.from(), to: todayIso() });
                  setOpen(false);
                }}
              >
                {preset.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-3 border-t p-3">
          <p className="text-xs font-medium text-muted-foreground">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-from`} className="text-xs">From</Label>
              <Input
                id={`${id}-from`}
                type="date"
                value={from ?? ""}
                max={to}
                onChange={(e) => onChange({ from: e.target.value || undefined, to })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-to`} className="text-xs">To</Label>
              <Input
                id={`${id}-to`}
                type="date"
                value={to ?? ""}
                min={from}
                aria-invalid={invalid}
                onChange={(e) => onChange({ from, to: e.target.value || undefined })}
              />
            </div>
          </div>
          {invalid && <p className="text-xs text-destructive">Start date must be before end date.</p>}
          {label && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange({})}>
              Clear dates
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function amountRangeLabel(minCents?: number, maxCents?: number) {
  const fmt = (c: number) => formatMoney(c, { compact: c >= 100_000 });
  if (minCents !== undefined && maxCents !== undefined) return `${fmt(minCents)} – ${fmt(maxCents)}`;
  if (minCents !== undefined) return `≥ ${fmt(minCents)}`;
  if (maxCents !== undefined) return `≤ ${fmt(maxCents)}`;
  return null;
}

export function AmountRangeFilter({
  minCents,
  maxCents,
  onChange,
}: {
  minCents?: number;
  maxCents?: number;
  onChange: (range: { minCents?: number; maxCents?: number }) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const label = amountRangeLabel(minCents, maxCents);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Load the applied values into the draft inputs each time the popover opens.
      setMin(minCents === undefined ? "" : centsToDecimalString(minCents));
      setMax(maxCents === undefined ? "" : centsToDecimalString(maxCents));
      setError(null);
    }
    setOpen(next);
  }

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const parsedMin = min.trim() ? parseMoneyToCents(min) : undefined;
    const parsedMax = max.trim() ? parseMoneyToCents(max) : undefined;
    if (parsedMin === null || parsedMax === null) return setError("Enter amounts like 1,250 or 1250.50");
    if (parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax) {
      return setError("Minimum must be less than maximum");
    }
    onChange({ minCents: parsedMin, maxCents: parsedMax });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(!label && "border-dashed")}>
          <DollarSign className="text-muted-foreground" aria-hidden="true" />
          {label ?? "Amount"}
          <ChevronDown className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form onSubmit={apply} className="space-y-3" noValidate>
          <p className="text-xs text-muted-foreground">Matches the absolute amount, in or out.</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-min`} className="text-xs">Min ($)</Label>
              <Input id={`${id}-min`} inputMode="decimal" placeholder="0.00" value={min} onChange={(e) => setMin(e.target.value)} aria-invalid={Boolean(error)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-max`} className="text-xs">Max ($)</Label>
              <Input id={`${id}-max`} inputMode="decimal" placeholder="Any" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={Boolean(error)} />
            </div>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            {label && (
              <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => { onChange({}); setOpen(false); }}>
                Clear
              </Button>
            )}
            <Button type="submit" size="sm" className="flex-1">Apply</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
