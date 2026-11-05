/**
 * Transfer business rules. Pure functions: given the ledger as it stands and a
 * schema-valid input, decide whether the transfer is allowed and which ledger
 * entries it creates. Used both when creating a transfer and when replaying the
 * client's event log, so a tampered or stale event can never overdraw an account.
 */
import { formatMoney } from "./money";
import type { LedgerEntry } from "./seed";
import type { Payee, TransferEvent, TransferInput } from "./schemas";
import { MAX_USER_TRANSFERS } from "./schemas";

/** Demo settlement times. In production: ACH 1–2 business days, wires same day. */
export const SETTLEMENT_MS = { ach: 20_000, wire: 8_000 } as const;
export const ACH_DAILY_LIMIT_CENTS = 10_000_000; // $100,000.00

export type TransferContext = {
  accounts: ReadonlyArray<{ id: string; name: string; last4: string; balanceCents: number }>;
  payees: readonly Payee[];
  /** ACH already sent by the user on the same UTC day, in cents (positive). */
  achSentTodayCents: number;
  userTransferCount: number;
};

export type TransferErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "PAYEE_NOT_FOUND"
  | "METHOD_NOT_SUPPORTED"
  | "SAME_ACCOUNT"
  | "INSUFFICIENT_FUNDS"
  | "DAILY_LIMIT_EXCEEDED"
  | "DEMO_LIMIT_REACHED";

export type TransferError = {
  code: TransferErrorCode;
  message: string;
  field: "fromAccountId" | "destination" | "amountCents" | null;
};

export type ValidationResult = { ok: true } | { ok: false; error: TransferError };

const fail = (code: TransferErrorCode, message: string, field: TransferError["field"]): ValidationResult => ({
  ok: false,
  error: { code, message, field },
});

export function validateTransfer(input: TransferInput, ctx: TransferContext): ValidationResult {
  if (ctx.userTransferCount >= MAX_USER_TRANSFERS) {
    return fail("DEMO_LIMIT_REACHED", "Demo limit reached. Reset the demo data to keep sending transfers.", null);
  }

  const from = ctx.accounts.find((a) => a.id === input.fromAccountId);
  if (!from) return fail("ACCOUNT_NOT_FOUND", "Source account not found", "fromAccountId");

  const { destination } = input;
  if (destination.kind === "internal") {
    if (destination.toAccountId === from.id) {
      return fail("SAME_ACCOUNT", "Choose a different account to transfer to", "destination");
    }
    if (!ctx.accounts.some((a) => a.id === destination.toAccountId)) {
      return fail("ACCOUNT_NOT_FOUND", "Destination account not found", "destination");
    }
  } else {
    const payee = ctx.payees.find((p) => p.id === destination.payeeId);
    if (!payee) return fail("PAYEE_NOT_FOUND", "Recipient not found", "destination");
    if (!payee.methods.includes(destination.method)) {
      return fail(
        "METHOD_NOT_SUPPORTED",
        `${payee.name} can't receive ${destination.method === "ach" ? "ACH" : "wire"} payments`,
        "destination",
      );
    }
  }

  if (input.amountCents > from.balanceCents) {
    return fail(
      "INSUFFICIENT_FUNDS",
      `Insufficient funds. ${from.name} has ${formatMoney(from.balanceCents)} available.`,
      "amountCents",
    );
  }

  if (
    destination.kind === "payee" &&
    destination.method === "ach" &&
    ctx.achSentTodayCents + input.amountCents > ACH_DAILY_LIMIT_CENTS
  ) {
    const remaining = Math.max(0, ACH_DAILY_LIMIT_CENTS - ctx.achSentTodayCents);
    return fail(
      "DAILY_LIMIT_EXCEEDED",
      `Exceeds the ${formatMoney(ACH_DAILY_LIMIT_CENTS)} daily ACH limit. ${formatMoney(remaining)} remaining today.`,
      "amountCents",
    );
  }

  return { ok: true };
}

/** Ledger entries produced by an accepted transfer. */
export function transferEntries(event: TransferEvent, ctx: TransferContext): LedgerEntry[] {
  const { input } = event;
  const from = ctx.accounts.find((a) => a.id === input.fromAccountId);
  if (!from) return [];

  const base = {
    postedAt: event.createdAt,
    currency: "USD" as const,
    memo: input.memo || null,
    cardId: null,
    transferId: event.id,
    failed: false,
  };
  const shortId = event.id.slice(0, 8).toUpperCase();

  if (input.destination.kind === "internal") {
    const toId = input.destination.toAccountId;
    const to = ctx.accounts.find((a) => a.id === toId);
    if (!to) return [];
    const reference = `INT-${shortId}`;
    return [
      { ...base, id: `${event.id}_out`, accountId: from.id, description: `Transfer to ${to.name}`, counterparty: `${to.name} ••${to.last4}`, category: "transfer", method: "internal", amountCents: -input.amountCents, settlesAt: null, reference },
      { ...base, id: `${event.id}_in`, accountId: to.id, description: `Transfer from ${from.name}`, counterparty: `${from.name} ••${from.last4}`, category: "transfer", method: "internal", amountCents: input.amountCents, settlesAt: null, reference },
    ];
  }

  const { payeeId, method } = input.destination;
  const payee = ctx.payees.find((p) => p.id === payeeId);
  if (!payee) return [];
  const settlesAt = new Date(new Date(event.createdAt).getTime() + SETTLEMENT_MS[method]).toISOString();

  return [
    {
      ...base,
      id: `${event.id}_out`,
      accountId: from.id,
      description: `${method === "ach" ? "ACH" : "Wire"} to ${payee.name}`,
      counterparty: payee.name,
      category: payee.category,
      method,
      amountCents: -input.amountCents,
      settlesAt,
      reference: method === "wire" ? `FED${shortId}` : `ACH${shortId}`,
    },
  ];
}
