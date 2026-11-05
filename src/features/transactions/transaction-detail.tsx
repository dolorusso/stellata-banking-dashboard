"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { HeroMoney } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatDateTime } from "@/lib/format";
import type { PaymentMethod, Transaction } from "@/lib/schemas";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  ach: "ACH",
  wire: "Wire",
  card: "Debit card",
  internal: "Internal transfer",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs">{value}</span>
      <Button variant="ghost" size="icon-xs" onClick={copy} aria-label={copied ? "Reference copied" : "Copy reference"}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </span>
  );
}

export function TransactionDetail({
  transaction,
  open,
  accountName,
  onOpenChange,
  returnFocusTo,
}: {
  /** Kept after closing so the sheet doesn't go blank during its exit animation. */
  transaction: Transaction | null;
  open: boolean;
  accountName?: string;
  onOpenChange: (open: boolean) => void;
  /** The sheet opens without a SheetTrigger, so tell it where focus should go back. */
  returnFocusTo?: HTMLElement | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-md"
        onCloseAutoFocus={(event) => {
          if (returnFocusTo?.isConnected) {
            event.preventDefault();
            returnFocusTo.focus();
          }
        }}
      >
        {transaction && (
          <>
            <SheetHeader className="border-b pb-5">
              <SheetDescription>{transaction.amountCents > 0 ? "Money in" : "Money out"}</SheetDescription>
              <SheetTitle className="text-3xl">
                <HeroMoney cents={transaction.amountCents} />
              </SheetTitle>
              <p className="text-base font-medium">{transaction.counterparty}</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={transaction.status} />
                {transaction.status === "pending" && transaction.settlesAt && (
                  <span className="text-xs text-muted-foreground">Expected {formatDateTime(transaction.settlesAt)}</span>
                )}
              </div>
            </SheetHeader>
            <dl className="divide-y px-4 text-sm">
              <Row label="Description">{transaction.description}</Row>
              <Row label="Date">{formatDateTime(transaction.postedAt)}</Row>
              <Row label="Account">{accountName ?? transaction.accountId}</Row>
              <Row label="Category">{CATEGORY_LABELS[transaction.category]}</Row>
              <Row label="Method">{METHOD_LABELS[transaction.method]}</Row>
              <Row label="Reference"><CopyReference value={transaction.reference} /></Row>
              {transaction.memo && <Row label="Memo">{transaction.memo}</Row>}
              {transaction.cardId && <Row label="Card">Virtual debit card</Row>}
              {transaction.status === "failed" && (
                <Row label="Failure">Returned by the receiving bank</Row>
              )}
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
