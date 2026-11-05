"use client";

import { AlertTriangle, ArrowLeft, Loader2, Send } from "lucide-react";
import type { ReactNode } from "react";
import { HeroMoney } from "@/components/shared/money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatMoney, sumCents } from "@/lib/money";
import type { Account, Payee, TransferInput } from "@/lib/schemas";
import { METHOD_LABELS, arrivalEstimate } from "./transfer-draft";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

type Props = {
  input: TransferInput;
  accounts: readonly Account[];
  payees: readonly Payee[];
  submitting: boolean;
  error?: string;
  onBack: () => void;
  onConfirm: () => void;
};

export function TransferReviewStep({ input, accounts, payees, submitting, error, onBack, onConfirm }: Props) {
  const from = accounts.find((a) => a.id === input.fromAccountId);
  const { destination } = input;
  const to =
    destination.kind === "internal"
      ? accounts.find((a) => a.id === destination.toAccountId)
      : payees.find((p) => p.id === destination.payeeId);
  const toLabel =
    destination.kind === "internal"
      ? to && `${to.name} ••${"last4" in to ? to.last4 : ""}`
      : to && `${to.name} · ${"bankName" in to ? `${to.bankName} ••${to.accountLast4}` : ""}`;
  const method = destination.kind === "internal" ? METHOD_LABELS.internal : METHOD_LABELS[destination.method];
  const remaining = from ? sumCents([from.balanceCents, -input.amountCents]) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-muted/60 p-5 text-center">
        <p className="text-sm text-muted-foreground">You&apos;re sending</p>
        <p className="mt-1 text-4xl">
          <HeroMoney cents={input.amountCents} />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">to {to?.name ?? "—"}</p>
      </div>

      <dl className="divide-y text-sm">
        <Row label="From">{from ? `${from.name} ••${from.last4}` : "—"}</Row>
        <Row label="To">{toLabel ?? "—"}</Row>
        <Row label="Method">{method}</Row>
        <Row label="Arrives">
          <span className="font-normal">{arrivalEstimate(input)}</span>
        </Row>
        <Row label="Fee">
          <span className="amount">{formatMoney(0)}</span>
        </Row>
        {remaining !== null && (
          <Row label={`${from?.name} after transfer`}>
            <span className="amount">{formatMoney(remaining)}</span>
          </Row>
        )}
        {input.memo && <Row label="Memo">{input.memo}</Row>}
      </dl>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Transfer failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" size="lg" className="h-11 sm:flex-1" onClick={onBack} disabled={submitting}>
          <ArrowLeft aria-hidden="true" /> Back
        </Button>
        <Button type="button" size="lg" className="h-11 sm:flex-[2]" onClick={onConfirm} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" /> Sending…
            </>
          ) : (
            <>
              <Send aria-hidden="true" /> Send {formatMoney(input.amountCents)}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
