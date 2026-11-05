import { describe, expect, it } from "vitest";
import { buildLedger } from "./ledger";
import { EMPTY_DEMO_STATE, type TransactionQuery } from "./schemas";
import { filterTransactions, queryTransactions, transactionsToCsv } from "./transactions-query";

const { transactions, accounts } = buildLedger(EMPTY_DEMO_STATE, new Date("2026-11-05T15:00:00.000Z"));

const query = (overrides: Partial<TransactionQuery> = {}): TransactionQuery => ({
  filters: {},
  sort: { id: "postedAt", desc: true },
  page: 0,
  pageSize: 25,
  ...overrides,
});

describe("queryTransactions", () => {
  it("paginates with a stable total", () => {
    const first = queryTransactions(transactions, query());
    const second = queryTransactions(transactions, query({ page: 1 }));
    expect(first.total).toBe(transactions.length);
    expect(first.rows).toHaveLength(25);
    expect(new Set([...first.rows, ...second.rows].map((t) => t.id)).size).toBe(50);
  });

  it("sorts by amount", () => {
    const { rows } = queryTransactions(transactions, query({ sort: { id: "amountCents", desc: false } }));
    expect(rows.map((r) => r.amountCents)).toEqual(rows.map((r) => r.amountCents).toSorted((a, b) => a - b));
  });

  it("combines filters", () => {
    const rows = filterTransactions(transactions, {
      q: "stripe",
      categories: ["revenue"],
      minCents: 500_000,
      from: "2026-08-01",
      to: "2026-10-31",
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.counterparty).toBe("Stripe");
      expect(Math.abs(row.amountCents)).toBeGreaterThanOrEqual(500_000);
      expect(row.postedAt >= "2026-08-01" && row.postedAt < "2026-11-01").toBe(true);
    }
  });
});

describe("filterTransactions by card", () => {
  it("returns only that card's transactions, across the whole history", () => {
    const cardId = transactions.find((t) => t.cardId)!.cardId!;
    const rows = filterTransactions(transactions, { cardIds: [cardId] });
    expect(rows.length).toBe(transactions.filter((t) => t.cardId === cardId).length);
    expect(rows.length).toBeGreaterThan(50); // more than one page: proves it's not a client-side slice
    expect(rows.every((t) => t.cardId === cardId)).toBe(true);
  });
});

describe("transactionsToCsv", () => {
  it("writes exact decimal amounts and escapes cells", () => {
    const sample = { ...transactions[0]!, description: 'Lunch, "team"', amountCents: -1_05, memo: "=SUM(A1)" };
    const csv = transactionsToCsv([sample], accounts);
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toContain("Amount (USD)");
    expect(row).toContain('"Lunch, ""team"""');
    expect(row).toContain(",-1.05,"); // negative amounts stay numeric, not '-1.05
    expect(row).toContain("'=SUM(A1)");
  });
});
