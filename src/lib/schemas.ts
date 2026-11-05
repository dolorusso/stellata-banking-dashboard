/**
 * Single source of truth for domain types. Client and server import these
 * schemas; TypeScript types are inferred with z.infer.
 */
import { z } from "zod";

export const CurrencySchema = z.literal("USD");
/** Integer cents. Always safe integers, never floats. */
export const CentsSchema = z.number().int().safe();

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
/** Calendar day (YYYY-MM-DD), interpreted in UTC. */
export const IsoDateSchema = z.iso.date();

// ── Accounts ────────────────────────────────────────────────────────────────
export const AccountKindSchema = z.enum(["operating", "payroll", "tax_reserve"]);
export type AccountKind = z.infer<typeof AccountKindSchema>;

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: AccountKindSchema,
  last4: z.string().length(4),
  routingNumber: z.string().length(9),
  currency: CurrencySchema,
  /** Ledger balance: opening + every non-failed transaction, pending included. */
  balanceCents: CentsSchema,
  /** Outgoing money still settling (already deducted from balanceCents). */
  pendingOutCents: CentsSchema,
});
export type Account = z.infer<typeof AccountSchema>;

// ── Transactions ────────────────────────────────────────────────────────────
export const CATEGORIES = [
  "revenue",
  "interest",
  "payroll",
  "contractors",
  "professional",
  "software",
  "rent",
  "utilities",
  "marketing",
  "travel",
  "meals",
  "office",
  "suppliers",
  "taxes",
  "transfer",
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

export const TransactionStatusSchema = z.enum(["pending", "completed", "failed"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const PaymentMethodSchema = z.enum(["ach", "wire", "card", "internal"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  postedAt: IsoDateTimeSchema,
  description: z.string(),
  counterparty: z.string(),
  category: CategorySchema,
  method: PaymentMethodSchema,
  /** Signed: positive = money in, negative = money out. */
  amountCents: CentsSchema,
  currency: CurrencySchema,
  status: TransactionStatusSchema,
  /** When a pending transaction completes. Null once there is nothing to wait for. */
  settlesAt: IsoDateTimeSchema.nullable(),
  reference: z.string(),
  memo: z.string().nullable(),
  cardId: z.string().nullable(),
  /** Set on transactions created by a user transfer. */
  transferId: z.string().nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// ── Payees & cards ──────────────────────────────────────────────────────────
export const TransferMethodSchema = z.enum(["ach", "wire"]);
export type TransferMethod = z.infer<typeof TransferMethodSchema>;

export const PayeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  bankName: z.string(),
  accountLast4: z.string().length(4),
  methods: z.array(TransferMethodSchema).min(1),
  category: CategorySchema,
});
export type Payee = z.infer<typeof PayeeSchema>;

export const CardStatusSchema = z.enum(["active", "frozen"]);
export type CardStatus = z.infer<typeof CardStatusSchema>;

export const CardSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  holderName: z.string(),
  nickname: z.string(),
  last4: z.string().length(4),
  expiry: z.string(),
  status: CardStatusSchema,
  monthlyLimitCents: CentsSchema,
  spentThisMonthCents: CentsSchema,
});
export type Card = z.infer<typeof CardSchema>;

// ── Transfers ───────────────────────────────────────────────────────────────
export const MAX_TRANSFER_CENTS = 100_000_000; // $1,000,000.00 per transfer
export const MAX_MEMO_LENGTH = 140;

export const TransferDestinationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("payee"), payeeId: z.string().min(1), method: TransferMethodSchema }),
  z.object({ kind: z.literal("internal"), toAccountId: z.string().min(1) }),
]);
export type TransferDestination = z.infer<typeof TransferDestinationSchema>;

export const TransferInputSchema = z.object({
  fromAccountId: z.string().min(1, "Choose an account to send from"),
  destination: TransferDestinationSchema,
  amountCents: CentsSchema.positive("Amount must be greater than $0.00").max(
    MAX_TRANSFER_CENTS,
    "Amount exceeds the $1,000,000.00 per-transfer maximum",
  ),
  memo: z
    .string()
    .trim()
    .max(MAX_MEMO_LENGTH, `Memo must be ${MAX_MEMO_LENGTH} characters or fewer`)
    .optional(),
});
export type TransferInput = z.infer<typeof TransferInputSchema>;

/** A transfer accepted by the server; the client stores it in its event log. */
export const TransferEventSchema = z.object({
  id: z.string().min(1),
  createdAt: IsoDateTimeSchema,
  input: TransferInputSchema,
});
export type TransferEvent = z.infer<typeof TransferEventSchema>;

export const TransferSchema = z.object({
  id: z.string(),
  createdAt: IsoDateTimeSchema,
  fromAccountId: z.string(),
  destinationName: z.string(),
  method: z.enum(["ach", "wire", "internal"]),
  amountCents: CentsSchema,
  currency: CurrencySchema,
  status: TransactionStatusSchema,
  settlesAt: IsoDateTimeSchema.nullable(),
  memo: z.string().nullable(),
});
export type Transfer = z.infer<typeof TransferSchema>;

// ── Client-held demo state (sent in every request body) ─────────────────────
export const MAX_USER_TRANSFERS = 100;

export const DemoStateSchema = z.object({
  version: z.literal(1),
  transfers: z.array(TransferEventSchema).max(MAX_USER_TRANSFERS),
  /** Compacted card state: latest status per card id, not a toggle history. */
  cardStatus: z.record(z.string(), CardStatusSchema),
});
export type DemoState = z.infer<typeof DemoStateSchema>;

export const EMPTY_DEMO_STATE: DemoState = { version: 1, transfers: [], cardStatus: {} };

// ── Request bodies ──────────────────────────────────────────────────────────
export const StateOnlyRequestSchema = z.object({ state: DemoStateSchema });

export const CreateTransferRequestSchema = z.object({
  state: DemoStateSchema,
  input: TransferInputSchema,
});

export const UpdateCardRequestSchema = z.object({
  state: DemoStateSchema,
  status: CardStatusSchema,
});

export const PAGE_SIZES = [10, 25, 50] as const;

export const TransactionSortSchema = z.object({
  id: z.enum(["postedAt", "amountCents", "counterparty", "category", "status"]),
  desc: z.boolean(),
});
export type TransactionSort = z.infer<typeof TransactionSortSchema>;

export const TransactionFiltersSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
    categories: z.array(CategorySchema).optional(),
    statuses: z.array(TransactionStatusSchema).optional(),
    accountIds: z.array(z.string()).optional(),
    cardIds: z.array(z.string()).optional(),
    /** Bounds on the absolute amount, in cents. */
    minCents: CentsSchema.nonnegative().optional(),
    maxCents: CentsSchema.nonnegative().optional(),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, {
    message: "Start date must be before end date",
    path: ["to"],
  })
  .refine((f) => f.minCents === undefined || f.maxCents === undefined || f.minCents <= f.maxCents, {
    message: "Minimum must be less than maximum",
    path: ["maxCents"],
  });
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;

export const TransactionQuerySchema = z.object({
  filters: TransactionFiltersSchema,
  sort: TransactionSortSchema,
  page: z.number().int().nonnegative(),
  pageSize: z.union(PAGE_SIZES.map((size) => z.literal(size))),
});
export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;

export const TransactionQueryRequestSchema = z.object({
  state: DemoStateSchema,
  query: TransactionQuerySchema,
});

export const TransactionExportRequestSchema = z.object({
  state: DemoStateSchema,
  filters: TransactionFiltersSchema,
  sort: TransactionSortSchema,
});

export const OVERVIEW_RANGES = ["30d", "90d", "180d"] as const;
export const OverviewRangeSchema = z.enum(OVERVIEW_RANGES);
export type OverviewRange = z.infer<typeof OverviewRangeSchema>;

export const OverviewRequestSchema = z.object({
  state: DemoStateSchema,
  range: OverviewRangeSchema,
});

// ── Responses ───────────────────────────────────────────────────────────────
const FlowTotalsSchema = z.object({
  inCents: CentsSchema,
  /** Positive number: money that left the business. */
  outCents: CentsSchema,
  netCents: CentsSchema,
});

export const OverviewSchema = z.object({
  range: OverviewRangeSchema,
  from: IsoDateSchema,
  to: IsoDateSchema,
  accounts: z.array(AccountSchema),
  totalBalanceCents: CentsSchema,
  pendingOutCents: CentsSchema,
  flows: FlowTotalsSchema,
  /** Same-length period right before `from`; null when history doesn't cover it. */
  previousFlows: FlowTotalsSchema.nullable(),
  /** Average net outflow per 30 days; 0 when cash-flow positive. */
  monthlyBurnCents: CentsSchema,
  runwayMonths: z.number().nullable(),
  cashFlow: z.array(FlowTotalsSchema.extend({ start: IsoDateSchema, end: IsoDateSchema })),
  spending: z.array(z.object({ category: CategorySchema, cents: CentsSchema })),
  balanceTrend: z.array(z.object({ date: IsoDateSchema, balanceCents: CentsSchema })),
  recent: z.array(TransactionSchema),
});
export type Overview = z.infer<typeof OverviewSchema>;

export const TransactionPageSchema = z.object({
  rows: z.array(TransactionSchema),
  total: z.number().int().nonnegative(),
});
export type TransactionPage = z.infer<typeof TransactionPageSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    field: z.string().optional(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
