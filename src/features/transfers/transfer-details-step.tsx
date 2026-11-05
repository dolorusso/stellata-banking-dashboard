"use client";

import { AlertTriangle, ArrowRight, Landmark, Repeat } from "lucide-react";
import { useId } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { centsToDecimalString, formatMoney } from "@/lib/money";
import { MAX_MEMO_LENGTH, type Account, type Payee, type TransferMethod } from "@/lib/schemas";
import { SETTLEMENT_MS } from "@/lib/transfers";
import { cn } from "@/lib/utils";
import type { DestinationKind, DraftErrors, DraftField, TransferDraft } from "./transfer-draft";

const METHOD_OPTIONS: { value: TransferMethod; title: string; detail: string }[] = [
  { value: "ach", title: "ACH", detail: `Free · settles in ~${SETTLEMENT_MS.ach / 1000}s in this demo (1–2 business days in production)` },
  { value: "wire", title: "Wire", detail: `Free · settles in ~${SETTLEMENT_MS.wire / 1000}s in this demo (same business day)` },
];

/** DOM id of each field, so the parent can focus the first invalid one. */
export const fieldId = (base: string, field: DraftField) => `${base}-${field}`;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

type Props = {
  idBase: string;
  draft: TransferDraft;
  errors: DraftErrors;
  accounts: readonly Account[];
  payees: readonly Payee[];
  onChange: (patch: Partial<TransferDraft>, touched: DraftField) => void;
  onContinue: () => void;
};

export function TransferDetailsStep({ idBase, draft, errors, accounts, payees, onChange, onContinue }: Props) {
  const memoCountId = useId();
  const from = accounts.find((a) => a.id === draft.fromAccountId);
  const payee = payees.find((p) => p.id === draft.payeeId);
  const id = (field: DraftField) => fieldId(idBase, field);
  const errId = (field: DraftField) => `${id(field)}-error`;
  const describedBy = (field: DraftField, extra?: string) =>
    [errors[field] ? errId(field) : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      {errors.form && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Transfer not allowed</AlertTitle>
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      )}

      {/* From */}
      <div className="space-y-2">
        <Label htmlFor={id("fromAccountId")}>From</Label>
        <Select
          value={draft.fromAccountId}
          onValueChange={(fromAccountId) =>
            onChange(
              { fromAccountId, ...(draft.toAccountId === fromAccountId ? { toAccountId: "" } : {}) },
              "fromAccountId",
            )
          }
        >
          <SelectTrigger
            id={id("fromAccountId")}
            className="h-11 w-full"
            aria-invalid={Boolean(errors.fromAccountId)}
            aria-describedby={describedBy("fromAccountId")}
          >
            <SelectValue placeholder="Choose an account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="font-medium">{a.name} ••{a.last4}</span>
                <span className="amount text-muted-foreground">{formatMoney(a.balanceCents)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={errId("fromAccountId")} message={errors.fromAccountId} />
      </div>

      {/* Destination */}
      <div className="space-y-3">
        <span className="text-sm font-medium" id={`${idBase}-kind-label`}>
          To
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={draft.kind}
          onValueChange={(kind) => kind && onChange({ kind: kind as DestinationKind }, "destination")}
          aria-labelledby={`${idBase}-kind-label`}
          className="w-full"
        >
          <ToggleGroupItem value="payee" className="h-9 flex-1">
            <Landmark aria-hidden="true" /> Pay someone
          </ToggleGroupItem>
          <ToggleGroupItem value="internal" className="h-9 flex-1">
            <Repeat aria-hidden="true" /> Between my accounts
          </ToggleGroupItem>
        </ToggleGroup>

        {draft.kind === "payee" ? (
          <div className="space-y-2">
            <Label htmlFor={id("destination")} className="sr-only">Recipient</Label>
            <Select
              value={draft.payeeId}
              onValueChange={(payeeId) => {
                const next = payees.find((p) => p.id === payeeId);
                // Keep the method valid for the chosen recipient.
                const method = next && !next.methods.includes(draft.method) ? next.methods[0] : draft.method;
                onChange({ payeeId, ...(method ? { method } : {}) }, "destination");
              }}
            >
              <SelectTrigger
                id={id("destination")}
                className="h-11 w-full"
                aria-invalid={Boolean(errors.destination)}
                aria-describedby={describedBy("destination")}
              >
                <SelectValue placeholder="Choose a saved recipient" />
              </SelectTrigger>
              <SelectContent>
                {payees.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">
                      {p.bankName} ••{p.accountLast4}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={errId("destination")} message={errors.destination} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={id("destination")} className="sr-only">To account</Label>
            <Select value={draft.toAccountId} onValueChange={(toAccountId) => onChange({ toAccountId }, "destination")}>
              <SelectTrigger
                id={id("destination")}
                className="h-11 w-full"
                aria-invalid={Boolean(errors.destination)}
                aria-describedby={describedBy("destination")}
              >
                <SelectValue placeholder="Choose one of your accounts" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== draft.fromAccountId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-medium">{a.name} ••{a.last4}</span>
                      <span className="amount text-muted-foreground">{formatMoney(a.balanceCents)}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <FieldError id={errId("destination")} message={errors.destination} />
            <p className="text-xs text-muted-foreground">Internal transfers are instant and free.</p>
          </div>
        )}
      </div>

      {/* Method (payees only) */}
      {draft.kind === "payee" && (
        <fieldset className="space-y-2" aria-describedby={describedBy("method")}>
          <legend className="mb-2 text-sm font-medium">Method</legend>
          <RadioGroup
            id={id("method")}
            value={draft.method}
            onValueChange={(method) => onChange({ method: method as TransferMethod }, "method")}
            className="grid gap-2 sm:grid-cols-2"
            aria-invalid={Boolean(errors.method)}
          >
            {METHOD_OPTIONS.map((option) => {
              const unsupported = payee !== undefined && !payee.methods.includes(option.value);
              const optionId = `${id("method")}-${option.value}`;
              return (
                <Label
                  key={option.value}
                  htmlFor={optionId}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-accent/50",
                    "has-data-checked:border-primary has-data-checked:bg-accent/60",
                    unsupported && "cursor-not-allowed opacity-60 hover:bg-transparent",
                  )}
                >
                  <RadioGroupItem id={optionId} value={option.value} disabled={unsupported} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {unsupported ? `${payee?.name} doesn't accept ${option.title} payments` : option.detail}
                    </span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
          <FieldError id={errId("method")} message={errors.method} />
        </fieldset>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor={id("amount")}>Amount</Label>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
            $
          </span>
          <Input
            id={id("amount")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => onChange({ amount: e.target.value }, "amount")}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={describedBy("amount", from ? `${id("amount")}-help` : undefined)}
            className="amount h-12 pl-7 text-lg md:text-lg"
          />
        </div>
        <FieldError id={errId("amount")} message={errors.amount} />
        {from && (
          <p id={`${id("amount")}-help`} className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Available in {from.name}: <span className="amount font-medium text-foreground">{formatMoney(from.balanceCents)}</span>
            </span>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0"
              onClick={() => onChange({ amount: centsToDecimalString(from.balanceCents) }, "amount")}
            >
              Use max
            </Button>
          </p>
        )}
      </div>

      {/* Memo */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={id("memo")}>
            Memo <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <span id={memoCountId} className="amount text-xs text-muted-foreground">
            {draft.memo.length}/{MAX_MEMO_LENGTH}
          </span>
        </div>
        <Input
          id={id("memo")}
          value={draft.memo}
          maxLength={MAX_MEMO_LENGTH}
          placeholder="e.g. Invoice 1042"
          onChange={(e) => onChange({ memo: e.target.value }, "memo")}
          aria-invalid={Boolean(errors.memo)}
          aria-describedby={describedBy("memo", memoCountId)}
        />
        <FieldError id={errId("memo")} message={errors.memo} />
      </div>

      <Button type="submit" size="lg" className="h-11 w-full">
        Review transfer <ArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}
