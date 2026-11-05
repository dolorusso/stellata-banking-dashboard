/**
 * Money is always an integer number of cents plus a currency.
 * Arithmetic stays in integers; conversion to a decimal only happens when
 * formatting for display (`formatMoney`) or serializing (`centsToDecimalString`).
 */
export const CURRENCY = "USD" as const;
export type Currency = typeof CURRENCY;
export type Money = { amountCents: number; currency: Currency };

/** Largest whole-dollar part we accept from user input (keeps cents < 2^53). */
const MAX_WHOLE_DIGITS = 13;

export function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function assertCents(value: number): number {
  if (!isCents(value)) throw new RangeError(`Invalid cents value: ${value}`);
  return value;
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += assertCents(value);
  return assertCents(total);
}

/**
 * Parses user input like "1,234.56", "$1234.5" or "1234" into cents.
 * Returns null for anything ambiguous: negatives, >2 decimals, bad grouping.
 * Never goes through parseFloat, so "0.1 + 0.2" style errors can't happen.
 */
const MONEY_INPUT = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{0,2}))?$/;

export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed === "$" || trimmed === ".") return null;
  const match = MONEY_INPUT.exec(trimmed);
  if (!match) return null;

  const whole = (match[1] ?? "0").replaceAll(",", "");
  if (whole.length > MAX_WHOLE_DIGITS) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");

  return Number(whole) * 100 + Number(fraction);
}

/** Exact decimal string ("-1234.05") using integer math only. For CSV/exports. */
export function centsToDecimalString(cents: number): string {
  assertCents(cents);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

type FormatOptions = {
  currency?: Currency;
  /** "exceptZero" renders +$1.00 / -$1.00, useful for inflow/outflow columns. */
  signDisplay?: "auto" | "exceptZero" | "never";
  /** $1.2M style for chart axes and dense KPIs. */
  compact?: boolean;
};

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter({ currency = CURRENCY, signDisplay = "auto", compact = false }: FormatOptions) {
  const key = `${currency}|${signDisplay}|${compact}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      signDisplay,
      ...(compact
        ? { notation: "compact", maximumFractionDigits: 1 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** UI-edge formatting. The only place cents become a fractional number. */
export function formatMoney(cents: number, options: FormatOptions = {}): string {
  return getFormatter(options).format(assertCents(cents) / 100);
}

/** Relative change between two cent amounts, as a ratio (0.12 = +12%). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
