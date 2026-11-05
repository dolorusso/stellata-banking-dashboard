/**
 * Transfer form draft → validated TransferInput. Pure (no React) so the same
 * rules run in tests, on "Continue", and when mapping server errors back to fields.
 */
import { parseMoneyToCents } from "@/lib/money";
import { TransferInputSchema, type Account, type Payee, type TransferInput, type TransferMethod } from "@/lib/schemas";
import { SETTLEMENT_MS, validateTransfer, type TransferError } from "@/lib/transfers";

export type DestinationKind = "payee" | "internal";

export type TransferDraft = {
  fromAccountId: string;
  kind: DestinationKind;
  payeeId: string;
  toAccountId: string;
  method: TransferMethod;
  /** Raw user input, e.g. "1,250.00". Parsed with parseMoneyToCents only. */
  amount: string;
  memo: string;
};

export type DraftField = "fromAccountId" | "destination" | "method" | "amount" | "memo";
export type DraftErrors = Partial<Record<DraftField | "form", string>>;

/** Order used to focus the first invalid field. */
export const FIELD_ORDER: readonly DraftField[] = ["fromAccountId", "destination", "method", "amount", "memo"];

export const emptyDraft = (fromAccountId = ""): TransferDraft => ({
  fromAccountId,
  kind: "payee",
  payeeId: "",
  toAccountId: "",
  method: "ach",
  amount: "",
  memo: "",
});

export function draftToInput(draft: TransferDraft, amountCents: number): TransferInput {
  const memo = draft.memo.trim();
  return {
    fromAccountId: draft.fromAccountId,
    destination:
      draft.kind === "internal"
        ? { kind: "internal", toAccountId: draft.toAccountId }
        : { kind: "payee", payeeId: draft.payeeId, method: draft.method },
    amountCents,
    ...(memo ? { memo } : {}),
  };
}

/** Maps a business-rule error (client pre-check or server 422) onto form fields. */
export function errorsFromTransferError(error: Pick<TransferError, "code" | "message" | "field">): DraftErrors {
  if (error.code === "METHOD_NOT_SUPPORTED") return { method: error.message };
  if (error.field === "amountCents") return { amount: error.message };
  if (error.field === "fromAccountId") return { fromAccountId: error.message };
  if (error.field === "destination") return { destination: error.message };
  return { form: error.message };
}

type Context = { accounts: readonly Account[]; payees: readonly Payee[]; userTransferCount: number };

export type DraftResult = { ok: true; input: TransferInput } | { ok: false; errors: DraftErrors };

export function validateDraft(draft: TransferDraft, ctx: Context): DraftResult {
  const errors: DraftErrors = {};

  if (!draft.fromAccountId) errors.fromAccountId = "Choose an account to send from";
  if (draft.kind === "payee" && !draft.payeeId) errors.destination = "Choose a recipient";
  if (draft.kind === "internal" && !draft.toAccountId) errors.destination = "Choose an account to transfer to";

  const amountCents = draft.amount.trim() === "" ? undefined : parseMoneyToCents(draft.amount);
  if (amountCents === undefined) errors.amount = "Enter an amount";
  else if (amountCents === null) errors.amount = "Enter a valid amount, like 1,250.00";

  if (Object.keys(errors).length > 0 || typeof amountCents !== "number") return { ok: false, errors };

  // Shared Zod schema: same rules the API enforces (positive, max, memo length…).
  const parsed = TransferInputSchema.safeParse(draftToInput(draft, amountCents));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [root] = issue.path;
      const field: DraftField =
        root === "amountCents" ? "amount" : root === "memo" ? "memo" : root === "destination" ? "destination" : "fromAccountId";
      errors[field] ??= issue.message;
    }
    return { ok: false, errors };
  }

  // Business rules against what the client knows. The server re-checks everything.
  const rules = validateTransfer(parsed.data, {
    accounts: ctx.accounts,
    payees: ctx.payees,
    achSentTodayCents: 0,
    userTransferCount: ctx.userTransferCount,
  });
  if (!rules.ok) return { ok: false, errors: errorsFromTransferError(rules.error) };

  return { ok: true, input: parsed.data };
}

export const METHOD_LABELS = { ach: "ACH", wire: "Wire", internal: "Internal transfer" } as const;

/** Human arrival estimate for the review step. */
export function arrivalEstimate(input: TransferInput): string {
  if (input.destination.kind === "internal") return "Instantly";
  const seconds = SETTLEMENT_MS[input.destination.method] / 1000;
  return input.destination.method === "ach"
    ? `~${seconds} seconds in this demo (1–2 business days in production)`
    : `~${seconds} seconds in this demo (same business day in production)`;
}
