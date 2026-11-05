import { Snowflake } from "lucide-react";
import type { Card } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** Four-point star from the logo, reused as a faint watermark. */
const STAR_PATH = "M16 5c.9 5.6 3.3 8.6 11 11-7.7 2.4-10.1 5.4-11 11-.9-5.6-3.3-8.6-11-11 7.7-2.4 10.1-5.4 11-11Z";

export function CardVisual({ card }: { card: Card }) {
  const frozen = card.status === "frozen";

  return (
    <figure
      aria-label={`${card.nickname} virtual debit card ending in ${card.last4}${frozen ? ", frozen" : ""}`}
      className="relative aspect-[1.586] w-full max-w-[380px] overflow-hidden rounded-2xl bg-brand text-sidebar-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-sidebar-border"
    >
      {/* Decorative layers: soft light from the top-left + oversized star watermark */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 0% 0%, color-mix(in oklch, var(--sidebar-foreground) 18%, transparent), transparent 60%)",
        }}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="absolute -right-10 -bottom-12 size-64 fill-sidebar-foreground opacity-[0.07]"
      >
        <path d={STAR_PATH} />
      </svg>

      <div
        className={cn(
          "relative flex h-full flex-col justify-between p-5 transition-[filter,opacity] duration-300 motion-reduce:transition-none",
          frozen && "opacity-60 grayscale",
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold tracking-tight">Stellata</p>
            <p className="text-xs text-sidebar-muted">Virtual · Debit</p>
          </div>
          <p className="text-xs font-medium text-sidebar-muted">{card.nickname}</p>
        </div>

        <p className="amount font-mono text-lg tracking-[0.18em] sm:text-xl" aria-hidden="true">
          •••• •••• •••• {card.last4}
        </p>

        <div className="flex items-end justify-between gap-4 text-sm">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-sidebar-muted">Cardholder</p>
            <p className="truncate font-medium">{card.holderName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-sidebar-muted">Expires</p>
            <p className="amount font-mono font-medium">{card.expiry}</p>
          </div>
        </div>
      </div>

      {frozen && (
        // Bottom-center sits between holder and expiry, so the pill never covers the card number.
        <div className="absolute inset-x-0 bottom-5 flex justify-center" aria-hidden="true">
          <span className="flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-sm font-semibold text-foreground shadow">
            <Snowflake className="size-4" />
            Frozen
          </span>
        </div>
      )}
    </figure>
  );
}
