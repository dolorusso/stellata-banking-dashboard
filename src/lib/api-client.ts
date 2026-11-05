/**
 * Typed client for the mock API. Every call attaches the client-held demo state.
 * Responses are validated with the same Zod schemas the server uses.
 */
import { z } from "zod";
import { readDemoState } from "./demo-state";
import {
  AccountSchema,
  ApiErrorBodySchema,
  CardSchema,
  OverviewSchema,
  PayeeSchema,
  TransactionPageSchema,
  TransferEventSchema,
  TransferSchema,
  type CardStatus,
  type OverviewRange,
  type TransactionFilters,
  type TransactionQuery,
  type TransactionSort,
  type TransferInput,
} from "./schemas";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  if (response.ok) return response;

  const body = ApiErrorBodySchema.safeParse(await response.json().catch(() => null));
  if (body.success) {
    const { message, code, field } = body.data.error;
    throw new ApiError(message, response.status, code, field);
  }
  throw new ApiError(`Request failed (${response.status})`, response.status);
}

async function call<S extends z.ZodType>(path: string, schema: S, body: object = {}, method = "POST"): Promise<z.infer<S>> {
  const response = await request(path, { method, body: JSON.stringify({ state: readDemoState(), ...body }) });
  return schema.parse(await response.json());
}

export const api = {
  overview: (range: OverviewRange) => call("/api/overview/query", OverviewSchema, { range }),

  accounts: () =>
    call("/api/accounts/query", z.object({ accounts: z.array(AccountSchema) })).then((r) => r.accounts),

  transactions: (query: TransactionQuery) => call("/api/transactions/query", TransactionPageSchema, { query }),

  exportTransactions: async (filters: TransactionFilters, sort: TransactionSort): Promise<Blob> => {
    const response = await request("/api/transactions/export", {
      method: "POST",
      body: JSON.stringify({ state: readDemoState(), filters, sort }),
    });
    return response.blob();
  },

  payees: async () => {
    const response = await request("/api/payees", { method: "GET" });
    return z.object({ payees: z.array(PayeeSchema) }).parse(await response.json()).payees;
  },

  transfers: () =>
    call("/api/transfers/query", z.object({ transfers: z.array(TransferSchema) })).then((r) => r.transfers),

  createTransfer: (input: TransferInput) =>
    call("/api/transfers", z.object({ event: TransferEventSchema, transfer: TransferSchema }), { input }),

  cards: () => call("/api/cards/query", z.object({ cards: z.array(CardSchema) })).then((r) => r.cards),

  updateCard: (id: string, status: CardStatus) =>
    call(`/api/cards/${encodeURIComponent(id)}`, z.object({ card: CardSchema }), { status }, "PATCH").then((r) => r.card),
};
