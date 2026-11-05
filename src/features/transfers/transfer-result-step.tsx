"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, CircleCheck, Clock, Plus } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { Transfer } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { METHOD_LABELS } from "./transfer-draft";
import { secondsUntil, transfersQuery, useNow } from "./transfers-query";

type StepState = "done" | "current" | "upcoming";

function Timeline({ steps }: { steps: { label: string; detail?: string; state: StepState }[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={cn("absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px", step.state === "done" ? "bg-primary" : "bg-border")}
            />
          )}
          <span
            aria-hidden="true"
            className={cn(
              "relative grid size-6 shrink-0 place-items-center rounded-full border text-xs",
              step.state === "done" && "border-primary bg-primary text-primary-foreground",
              step.state === "current" && "border-primary text-primary",
              step.state === "upcoming" && "text-muted-foreground",
            )}
          >
            {step.state === "done" ? <Check className="size-3.5" /> : step.state === "current" ? <Clock className="size-3.5" /> : index + 1}
          </span>
          <div className="pt-0.5">
            <p className={cn("text-sm font-medium", step.state === "upcoming" && "text-muted-foreground")}>
              {step.label}
              <span className="sr-only"> ({step.state === "done" ? "complete" : step.state === "current" ? "in progress" : "not started"})</span>
            </p>
            {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TransferResultStep({ initial, onReset }: { initial: Transfer; onReset: () => void }) {
  // The transfers query polls while this transfer settles; fall back to the POST response.
  const { data } = useQuery(transfersQuery);
  const transfer = data?.find((t) => t.id === initial.id) ?? initial;
  const pending = transfer.status === "pending";
  const now = useNow(pending);
  const seconds = secondsUntil(transfer.settlesAt, now);
  const completed = transfer.status === "completed";

  // Announce status changes only. The countdown ticks every second and stays visual
  // (it would otherwise be re-read every second by screen readers).
  const announcement = completed
    ? `Transfer of ${formatMoney(transfer.amountCents)} to ${transfer.destinationName} completed.`
    : transfer.status === "failed"
      ? "Transfer failed."
      : "Transfer submitted. Processing.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className={cn(
            "grid size-12 place-items-center rounded-full",
            completed ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning",
          )}
          aria-hidden="true"
        >
          {completed ? <CircleCheck className="size-6" /> : <Clock className="size-6" />}
        </span>
        <div>
          <p className="text-2xl font-semibold tracking-tight">{formatMoney(transfer.amountCents)}</p>
          <p className="text-sm text-muted-foreground">
            to {transfer.destinationName} · {METHOD_LABELS[transfer.method]}
          </p>
        </div>
        <StatusBadge status={transfer.status} />
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </div>

      <div className="rounded-xl border p-4">
        <Timeline
          steps={[
            { label: "Submitted", detail: formatDateTime(transfer.createdAt), state: "done" },
            {
              label: "Processing",
              detail: pending ? (seconds ? `Settles in ~${seconds}s` : "Settling…") : transfer.method === "internal" ? "Instant" : undefined,
              state: pending ? "current" : "done",
            },
            { label: "Completed", detail: completed ? "Funds delivered" : undefined, state: completed ? "done" : "upcoming" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" size="lg" className="h-11 sm:flex-1" asChild>
          <Link href="/transactions">View in transactions</Link>
        </Button>
        <Button type="button" size="lg" className="h-11 sm:flex-1" onClick={onReset}>
          <Plus aria-hidden="true" /> Make another transfer
        </Button>
      </div>
    </div>
  );
}
