import { describe, expect, it } from "vitest";
import { PAYEES } from "./seed";
import { MAX_USER_TRANSFERS, TransferInputSchema, type TransferInput } from "./schemas";
import { ACH_DAILY_LIMIT_CENTS, validateTransfer, type TransferContext } from "./transfers";

const ctx = (overrides: Partial<TransferContext> = {}): TransferContext => ({
  accounts: [
    { id: "a", name: "Operating", last4: "1111", balanceCents: 500_000 },
    { id: "b", name: "Payroll", last4: "2222", balanceCents: 10_000 },
  ],
  payees: PAYEES,
  achSentTodayCents: 0,
  userTransferCount: 0,
  ...overrides,
});

const achTo = (payeeId: string, amountCents: number, fromAccountId = "a"): TransferInput => ({
  fromAccountId,
  destination: { kind: "payee", payeeId, method: "ach" },
  amountCents,
});

describe("TransferInputSchema", () => {
  const valid = { fromAccountId: "a", destination: { kind: "internal", toAccountId: "b" }, amountCents: 100 };

  it("accepts a well-formed transfer and trims the memo", () => {
    const parsed = TransferInputSchema.parse({ ...valid, memo: "  Invoice 42  " });
    expect(parsed.memo).toBe("Invoice 42");
  });

  it.each([
    ["zero amount", { ...valid, amountCents: 0 }],
    ["negative amount", { ...valid, amountCents: -100 }],
    ["fractional cents", { ...valid, amountCents: 10.5 }],
    ["over the per-transfer max", { ...valid, amountCents: 100_000_001 }],
    ["amount as string", { ...valid, amountCents: "100" }],
    ["unknown destination kind", { ...valid, destination: { kind: "crypto", address: "x" } }],
    ["unsupported method", { ...valid, destination: { kind: "payee", payeeId: "p", method: "rtp" } }],
    ["memo too long", { ...valid, memo: "x".repeat(141) }],
    ["missing source", { ...valid, fromAccountId: "" }],
  ])("rejects %s", (_label, input) => {
    expect(TransferInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("validateTransfer", () => {
  it("allows a transfer within the available balance", () => {
    expect(validateTransfer(achTo("py_fernhill", 500_000), ctx())).toEqual({ ok: true });
  });

  it("rejects insufficient funds, one cent over the balance", () => {
    const result = validateTransfer(achTo("py_fernhill", 500_001), ctx());
    expect(result).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_FUNDS", field: "amountCents" } });
  });

  it("rejects transfers to the same account", () => {
    const input: TransferInput = { fromAccountId: "a", destination: { kind: "internal", toAccountId: "a" }, amountCents: 1 };
    expect(validateTransfer(input, ctx())).toMatchObject({ ok: false, error: { code: "SAME_ACCOUNT" } });
  });

  it("rejects unknown accounts and payees", () => {
    expect(validateTransfer(achTo("py_fernhill", 1, "nope"), ctx())).toMatchObject({ error: { code: "ACCOUNT_NOT_FOUND" } });
    expect(validateTransfer(achTo("py_nope", 1), ctx())).toMatchObject({ error: { code: "PAYEE_NOT_FOUND" } });
  });

  it("rejects a method the payee doesn't accept", () => {
    // Atlas Components only accepts wires.
    expect(validateTransfer(achTo("py_atlas", 100), ctx())).toMatchObject({ error: { code: "METHOD_NOT_SUPPORTED" } });
  });

  it("enforces the daily ACH limit but not for wires", () => {
    const rich = ctx({
      accounts: [{ id: "a", name: "Operating", last4: "1111", balanceCents: 50_000_000 }],
      achSentTodayCents: ACH_DAILY_LIMIT_CENTS - 100,
    });
    expect(validateTransfer(achTo("py_brightline", 100), rich)).toEqual({ ok: true });
    expect(validateTransfer(achTo("py_brightline", 101), rich)).toMatchObject({ error: { code: "DAILY_LIMIT_EXCEEDED" } });

    const wire: TransferInput = { fromAccountId: "a", destination: { kind: "payee", payeeId: "py_brightline", method: "wire" }, amountCents: 1_000_000 };
    expect(validateTransfer(wire, rich)).toEqual({ ok: true });
  });

  it("stops at the demo transfer cap", () => {
    expect(validateTransfer(achTo("py_fernhill", 1), ctx({ userTransferCount: MAX_USER_TRANSFERS }))).toMatchObject({
      error: { code: "DEMO_LIMIT_REACHED" },
    });
  });
});
