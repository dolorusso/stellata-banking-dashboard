"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api-client";
import { appendTransferEvent, readDemoState } from "@/lib/demo-state";
import { formatMoney } from "@/lib/money";
import type { Account, Payee, Transfer, TransferInput } from "@/lib/schemas";
import type { TransferErrorCode } from "@/lib/transfers";
import { cn } from "@/lib/utils";
import { TransferDetailsStep, fieldId } from "./transfer-details-step";
import {
  FIELD_ORDER,
  emptyDraft,
  errorsFromTransferError,
  validateDraft,
  type DraftErrors,
  type DraftField,
  type TransferDraft,
} from "./transfer-draft";
import { TransferResultStep } from "./transfer-result-step";
import { TransferReviewStep } from "./transfer-review-step";

type Step = { name: "details" } | { name: "review"; input: TransferInput } | { name: "result"; transfer: Transfer };

const STEPS = [
  { name: "details", title: "Transfer details", description: "Who, how and how much." },
  { name: "review", title: "Review and confirm", description: "Check the details before sending." },
  { name: "result", title: "Transfer submitted", description: "Track it until it settles." },
] as const;

/**
 * A 422 is a business-rule rejection: map it back to the form. Deciding by status
 * (not a hand-copied list of codes) keeps new server codes working; unknown codes
 * fall through to a form-level alert in `errorsFromTransferError`.
 */
const isRuleRejection = (error: unknown): error is ApiError => error instanceof ApiError && error.status === 422;

export function TransferFlow({ accounts, payees }: { accounts: readonly Account[]; payees: readonly Payee[] }) {
  const idBase = useId();
  const queryClient = useQueryClient();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>({ name: "details" });
  const [draft, setDraft] = useState<TransferDraft>(() => emptyDraft(accounts[0]?.id));
  const [errors, setErrors] = useState<DraftErrors>({});

  // Where focus should go once the next render is committed: the step heading
  // (step changes) or the first invalid field (validation errors).
  const pendingFocus = useRef<"heading" | DraftField | null>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "heading") return headingRef.current?.focus();
    const el = document.getElementById(fieldId(idBase, target));
    (target === "method" ? el?.querySelector<HTMLElement>("button:not(:disabled)") : el)?.focus();
  });

  const goTo = (next: Step) => {
    pendingFocus.current = "heading";
    setStep(next);
  };

  const showErrors = (next: DraftErrors) => {
    setErrors(next);
    setStep({ name: "details" });
    pendingFocus.current = FIELD_ORDER.find((field) => next[field]) ?? "heading";
  };

  const mutation = useMutation({
    mutationFn: api.createTransfer,
    onSuccess: ({ event, transfer }) => {
      appendTransferEvent(event);
      // Balances, overview, transactions and transfers all derive from the event log.
      void queryClient.invalidateQueries();
      toast.success(`${formatMoney(transfer.amountCents)} to ${transfer.destinationName} submitted`);
      goTo({ name: "result", transfer });
    },
    onError: (error) => {
      if (isRuleRejection(error)) {
        const field = (error.field ?? null) as "fromAccountId" | "destination" | "amountCents" | null;
        showErrors(errorsFromTransferError({ code: error.code as TransferErrorCode, message: error.message, field }));
      }
      // Other failures (network, 5xx) stay on the review step with a retry.
    },
  });

  function onChange(patch: Partial<TransferDraft>, touched: DraftField) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => (prev[touched] || prev.form ? { ...prev, [touched]: undefined, form: undefined } : prev));
  }

  function onContinue() {
    const result = validateDraft(draft, {
      accounts,
      payees,
      userTransferCount: readDemoState().transfers.length,
    });
    if (!result.ok) return showErrors(result.errors);
    setErrors({});
    mutation.reset();
    goTo({ name: "review", input: result.input });
  }

  function reset() {
    setDraft(emptyDraft(draft.fromAccountId || accounts[0]?.id));
    setErrors({});
    mutation.reset();
    goTo({ name: "details" });
  }

  const index = STEPS.findIndex((s) => s.name === step.name);
  const meta = STEPS[index]!;
  const reviewError =
    mutation.isError && !isRuleRejection(mutation.error)
      ? mutation.error.message || "Something went wrong. Please try again."
      : undefined;

  return (
    <Card>
      <CardHeader>
        {/* Step indicator */}
        <ol className="mb-3 flex items-center gap-2" aria-label="Transfer progress">
          {STEPS.slice(0, 2).map((s, i) => (
            <li
              key={s.name}
              aria-current={index === i ? "step" : undefined}
              className={cn("h-1 flex-1 rounded-full bg-muted", i <= index && "bg-primary")}
            >
              <span className="sr-only">
                Step {i + 1}: {s.title}
                {i < index ? " (complete)" : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs font-medium text-muted-foreground">
          {step.name === "result" ? "Done" : `Step ${index + 1} of 2`}
        </p>
        <CardTitle>
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            {meta.title}
          </h2>
        </CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {step.name === "details" && (
          <TransferDetailsStep
            idBase={idBase}
            draft={draft}
            errors={errors}
            accounts={accounts}
            payees={payees}
            onChange={onChange}
            onContinue={onContinue}
          />
        )}
        {step.name === "review" && (
          <TransferReviewStep
            input={step.input}
            accounts={accounts}
            payees={payees}
            submitting={mutation.isPending}
            error={reviewError}
            onBack={() => goTo({ name: "details" })}
            onConfirm={() => !mutation.isPending && mutation.mutate(step.input)}
          />
        )}
        {step.name === "result" && <TransferResultStep initial={step.transfer} onReset={reset} />}
      </CardContent>
    </Card>
  );
}
