import { describe, expect, it } from "vitest";
import { buildLedger, createTransfer } from "./ledger";
import { ACCOUNT_IDS, CARD_ID, generateSeed } from "./seed";
import { EMPTY_DEMO_STATE, type DemoState, type TransferInput } from "./schemas";
import { SETTLEMENT_MS } from "./transfers";

const NOW = new Date("2026-11-05T15:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const balanceOf = (state: DemoState, id: string, now = NOW) =>
  buildLedger(state, now).accounts.find((a) => a.id === id)!.balanceCents;

const internal = (amountCents: number): TransferInput => ({
  fromAccountId: ACCOUNT_IDS.operating,
  destination: { kind: "internal", toAccountId: ACCOUNT_IDS.payroll },
  amountCents,
});

const wire = (amountCents: number): TransferInput => ({
  fromAccountId: ACCOUNT_IDS.operating,
  destination: { kind: "payee", payeeId: "py_brightline", method: "wire" },
  amountCents,
});

function apply(state: DemoState, input: TransferInput, now = NOW, id?: string): DemoState {
  const result = createTransfer(state, input, now, id);
  if (!result.ok) throw new Error(result.error.message);
  return { ...state, transfers: [...state.transfers, result.event] };
}

describe("seed", () => {
  it("is deterministic for the same day", () => {
    expect(generateSeed(NOW)).toEqual(generateSeed(new Date("2026-11-05T23:59:00.000Z")));
  });

  it("produces ~200 realistic transactions with integer cents", () => {
    const { transactions } = buildLedger(EMPTY_DEMO_STATE, NOW);
    expect(transactions.length).toBeGreaterThanOrEqual(180);
    expect(transactions.length).toBeLessThanOrEqual(260);
    expect(transactions.every((t) => Number.isSafeInteger(t.amountCents) && t.amountCents !== 0)).toBe(true);
    expect(new Set(transactions.map((t) => t.status))).toEqual(new Set(["completed", "pending", "failed"]));
  });

  it("lands on the target balances", () => {
    const { accounts } = buildLedger(EMPTY_DEMO_STATE, NOW);
    expect(accounts.map((a) => [a.name, a.balanceCents])).toEqual([
      ["Operating", 24_831_542],
      ["Payroll", 4_120_618],
      ["Tax Reserve", 6_348_090],
    ]);
  });

  it("never overdraws an account at any point in history", () => {
    const seed = generateSeed(NOW);
    for (const account of seed.accounts) {
      let running = account.openingBalanceCents;
      const entries = seed.entries
        .filter((e) => e.accountId === account.id && !e.failed)
        .toSorted((a, b) => a.postedAt.localeCompare(b.postedAt));
      for (const entry of entries) {
        running += entry.amountCents;
        expect(running, `${account.name} after ${entry.id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("balance updates", () => {
  it("internal transfers move money between accounts instantly and conserve the total", () => {
    const before = buildLedger(EMPTY_DEMO_STATE, NOW);
    const state = apply(EMPTY_DEMO_STATE, internal(1_234_56));
    const after = buildLedger(state, NOW);

    expect(balanceOf(state, ACCOUNT_IDS.operating)).toBe(balanceOf(EMPTY_DEMO_STATE, ACCOUNT_IDS.operating) - 1_234_56);
    expect(balanceOf(state, ACCOUNT_IDS.payroll)).toBe(balanceOf(EMPTY_DEMO_STATE, ACCOUNT_IDS.payroll) + 1_234_56);

    const total = (l: typeof before) => l.accounts.reduce((sum, a) => sum + a.balanceCents, 0);
    expect(total(after)).toBe(total(before));
    expect(after.transactions.length).toBe(before.transactions.length + 2);
    expect(after.transfers[0]).toMatchObject({ method: "internal", status: "completed", amountCents: 1_234_56 });
  });

  it("external transfers debit immediately, stay pending, then complete", () => {
    const state = apply(EMPTY_DEMO_STATE, wire(500_000));
    const opBefore = balanceOf(EMPTY_DEMO_STATE, ACCOUNT_IDS.operating);

    const pending = buildLedger(state, later(1_000));
    const operating = pending.accounts.find((a) => a.id === ACCOUNT_IDS.operating)!;
    expect(operating.balanceCents).toBe(opBefore - 500_000);
    expect(operating.pendingOutCents).toBeGreaterThanOrEqual(500_000);
    expect(pending.transfers[0]).toMatchObject({ status: "pending", method: "wire" });
    expect(pending.transactions[0]).toMatchObject({ amountCents: -500_000, status: "pending", counterparty: "Brightline Design Co." });

    const settled = buildLedger(state, later(SETTLEMENT_MS.wire + 1));
    expect(settled.transfers[0]).toMatchObject({ status: "completed", settlesAt: null });
    expect(balanceOf(state, ACCOUNT_IDS.operating, later(SETTLEMENT_MS.wire + 1))).toBe(opBefore - 500_000);
  });

  it("rejects a transfer that exceeds the balance after earlier transfers", () => {
    const payroll = balanceOf(EMPTY_DEMO_STATE, ACCOUNT_IDS.payroll);
    const drain: TransferInput = {
      fromAccountId: ACCOUNT_IDS.payroll,
      destination: { kind: "internal", toAccountId: ACCOUNT_IDS.tax },
      amountCents: payroll,
    };
    const state = apply(EMPTY_DEMO_STATE, drain);
    expect(balanceOf(state, ACCOUNT_IDS.payroll)).toBe(0);

    const again = createTransfer(state, { ...drain, amountCents: 1 }, NOW);
    expect(again).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_FUNDS" } });
  });

  it("drops tampered events on replay instead of overdrawing", () => {
    const forged: DemoState = {
      ...EMPTY_DEMO_STATE,
      transfers: [{ id: "forged", createdAt: NOW.toISOString(), input: wire(99_999_999) }],
    };
    expect(balanceOf(forged, ACCOUNT_IDS.operating)).toBe(balanceOf(EMPTY_DEMO_STATE, ACCOUNT_IDS.operating));
    expect(buildLedger(forged, NOW).transfers).toHaveLength(0);
  });

  it("ignores duplicated events (idempotent replay)", () => {
    const state = apply(EMPTY_DEMO_STATE, internal(10_000), NOW, "t1");
    const duplicated = { ...state, transfers: [...state.transfers, ...state.transfers] };
    expect(balanceOf(duplicated, ACCOUNT_IDS.operating)).toBe(balanceOf(state, ACCOUNT_IDS.operating));
  });
});

describe("cards", () => {
  it("defaults to active and reflects the stored status", () => {
    expect(buildLedger(EMPTY_DEMO_STATE, NOW).cards[0]?.status).toBe("active");
    const frozen = { ...EMPTY_DEMO_STATE, cardStatus: { [CARD_ID]: "frozen" as const } };
    expect(buildLedger(frozen, NOW).cards[0]?.status).toBe("frozen");
  });
});
