/**
 * The mock backend's "database": seed + replayed user events → full ledger.
 *
 * Stateless by design. Serverless instances don't share memory, so every
 * request carries the client's event log and the server rebuilds the ledger
 * (cheap: ~200 rows). Events are re-validated on replay, so the client can
 * store them but can't use them to forge balances.
 */
import { getSeed, type LedgerEntry } from "./seed";
import type {
  Account,
  Card,
  CardStatus,
  DemoState,
  Payee,
  Transaction,
  TransactionStatus,
  Transfer,
  TransferEvent,
  TransferInput,
} from "./schemas";
import { transferEntries, validateTransfer, type TransferContext, type TransferError } from "./transfers";

/** Tolerated clock skew for event timestamps from the future. */
const MAX_CLOCK_SKEW_MS = 60_000;

export type Ledger = {
  now: Date;
  accounts: Account[];
  /** Newest first. */
  transactions: Transaction[];
  payees: Payee[];
  cards: Card[];
  /** User-initiated transfers, newest first. */
  transfers: Transfer[];
  acceptedTransferIds: Set<string>;
  achSentByDay: Map<string, number>;
};

export function resolveStatus(entry: LedgerEntry, now: Date): TransactionStatus {
  if (entry.failed) return "failed";
  if (entry.settlesAt && Date.parse(entry.settlesAt) > now.getTime()) return "pending";
  return "completed";
}

const utcDay = (iso: string) => iso.slice(0, 10);

export function buildLedger(state: DemoState, now: Date = new Date()): Ledger {
  const seed = getSeed(now);
  const entries: LedgerEntry[] = [...seed.entries];

  const balances = new Map(seed.accounts.map((a) => [a.id, a.openingBalanceCents]));
  const post = (entry: LedgerEntry) => {
    entries.push(entry);
    if (!entry.failed) balances.set(entry.accountId, (balances.get(entry.accountId) ?? 0) + entry.amountCents);
  };
  for (const entry of seed.entries) {
    if (!entry.failed) balances.set(entry.accountId, (balances.get(entry.accountId) ?? 0) + entry.amountCents);
  }

  const acceptedTransferIds = new Set<string>();
  const achSentByDay = new Map<string, number>();

  const context = (event: TransferEvent): TransferContext => ({
    accounts: seed.accounts.map((a) => ({ ...a, balanceCents: balances.get(a.id) ?? 0 })),
    payees: seed.payees,
    achSentTodayCents: achSentByDay.get(utcDay(event.createdAt)) ?? 0,
    userTransferCount: acceptedTransferIds.size,
  });

  const events = state.transfers
    .filter((e) => Date.parse(e.createdAt) <= now.getTime() + MAX_CLOCK_SKEW_MS)
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const event of events) {
    if (acceptedTransferIds.has(event.id)) continue;
    const ctx = context(event);
    if (!validateTransfer(event.input, ctx).ok) continue; // stale or tampered: drop it
    transferEntries(event, ctx).forEach(post);
    acceptedTransferIds.add(event.id);
    const { destination } = event.input;
    if (destination.kind === "payee" && destination.method === "ach") {
      const day = utcDay(event.createdAt);
      achSentByDay.set(day, (achSentByDay.get(day) ?? 0) + event.input.amountCents);
    }
  }

  const transactions: Transaction[] = entries
    .map(({ failed, ...entry }) => {
      const status = resolveStatus({ ...entry, failed }, now);
      return { ...entry, status, settlesAt: status === "pending" ? entry.settlesAt : null };
    })
    .toSorted((a, b) => b.postedAt.localeCompare(a.postedAt));

  const accounts: Account[] = seed.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    kind: account.kind,
    last4: account.last4,
    routingNumber: account.routingNumber,
    currency: account.currency,
    balanceCents: balances.get(account.id) ?? 0,
    pendingOutCents: transactions
      .filter((t) => t.accountId === account.id && t.status === "pending" && t.amountCents < 0)
      .reduce((sum, t) => sum - t.amountCents, 0),
  }));

  const monthPrefix = now.toISOString().slice(0, 7);
  const cards: Card[] = seed.cards.map((card) => ({
    ...card,
    status: state.cardStatus[card.id] ?? "active",
    spentThisMonthCents: transactions
      .filter((t) => t.cardId === card.id && t.status !== "failed" && t.postedAt.startsWith(monthPrefix))
      .reduce((sum, t) => sum - t.amountCents, 0),
  }));

  const accountName = new Map(seed.accounts.map((a) => [a.id, a.name]));
  const transfers: Transfer[] = transactions
    .filter((t) => t.transferId && t.id.endsWith("_out"))
    .map((t) => {
      const event = state.transfers.find((e) => e.id === t.transferId);
      const destination = event?.input.destination;
      return {
        id: t.transferId!,
        createdAt: t.postedAt,
        fromAccountId: t.accountId,
        destinationName:
          destination?.kind === "internal" ? (accountName.get(destination.toAccountId) ?? t.counterparty) : t.counterparty,
        method: t.method === "card" ? "internal" : t.method,
        amountCents: -t.amountCents,
        currency: "USD",
        status: t.status,
        settlesAt: t.settlesAt,
        memo: t.memo,
      };
    });

  return { now, accounts, transactions, payees: seed.payees, cards, transfers, acceptedTransferIds, achSentByDay };
}

export type CreateTransferResult =
  | { ok: true; event: TransferEvent; transfer: Transfer; ledger: Ledger }
  | { ok: false; error: TransferError };

/** Validates a new transfer against the current ledger and, if allowed, applies it. */
export function createTransfer(
  state: DemoState,
  input: TransferInput,
  now: Date,
  id: string = crypto.randomUUID(),
): CreateTransferResult {
  const current = buildLedger(state, now);
  const createdAt = now.toISOString();
  const validation = validateTransfer(input, {
    accounts: current.accounts,
    payees: current.payees,
    achSentTodayCents: current.achSentByDay.get(utcDay(createdAt)) ?? 0,
    userTransferCount: current.acceptedTransferIds.size,
  });
  if (!validation.ok) return validation;

  const event: TransferEvent = { id, createdAt, input };
  const ledger = buildLedger({ ...state, transfers: [...state.transfers, event] }, now);
  const transfer = ledger.transfers.find((t) => t.id === id);
  if (!transfer) {
    return { ok: false, error: { code: "ACCOUNT_NOT_FOUND", message: "Transfer could not be applied", field: null } };
  }
  return { ok: true, event, transfer, ledger };
}

export function findCard(ledger: Ledger, cardId: string): Card | undefined {
  return ledger.cards.find((c) => c.id === cardId);
}

export function withCardStatus(state: DemoState, cardId: string, status: CardStatus): DemoState {
  return { ...state, cardStatus: { ...state.cardStatus, [cardId]: status } };
}
