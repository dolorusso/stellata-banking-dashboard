/**
 * Date formatting at the UI edge. Calendar days (YYYY-MM-DD) are UTC days, so
 * they're formatted in UTC to avoid off-by-one shifts in western time zones.
 */
const dayFormatters = {
  short: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  medium: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Nov 5" (short) or "Nov 5, 2026" (medium) for an ISO day or timestamp. */
export function formatDay(iso: string, style: keyof typeof dayFormatters = "short") {
  return dayFormatters[style].format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
}

/** "Nov 5 – Nov 11" (or a single day when start === end). */
export function formatDayRange(start: string, end: string) {
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
}

/** Local date + time, e.g. "Nov 5, 2026, 3:04 PM". */
export function formatDateTime(iso: string) {
  return dateTimeFormatter.format(new Date(iso));
}

const percentFormatter = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
export const formatPercentChange = (ratio: number) => percentFormatter.format(ratio);
