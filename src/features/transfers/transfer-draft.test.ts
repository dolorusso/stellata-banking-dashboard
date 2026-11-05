import { describe, expect, it } from "vitest";
import { PAYEES } from "@/lib/seed";
import type { Account } from "@/lib/schemas";
import { emptyDraft, errorsFromTransferError, validateDraft, type TransferDraft } from "./transfer-draft";

const account = (id: string, balanceCents: number): Account => ({
  id,
  name: id,
  kind: "operating",
  last4: "0000",
  routingNumber: "000000000",
  currency: "USD",
  balanceCents,
  pendingOutCents: 0,
});

const ctx = { accounts: [account("a", 100_000), account("b", 0)], payees: PAYEES, userTransferCount: 0 };
const draft = (patch: Partial<TransferDraft>): TransferDraft => ({ ...emptyDraft("a"), payeeId: "py_fernhill", amount: "250", ...patch });

describe("validateDraft", () => {
  it("builds a schema-valid input with integer cents", () => {
    const result = validateDraft(draft({ amount: "$999.5", memo: "  Retainer  " }), ctx);
    expect(result).toEqual({
      ok: true,
      input: {
        fromAccountId: "a",
        destination: { kind: "payee", payeeId: "py_fernhill", method: "ach" },
        amountCents: 99_950,
        memo: "Retainer",
      },
    });
  });

  it("requires a recipient and an amount", () => {
    const result = validateDraft(draft({ payeeId: "", amount: "" }), ctx);
    expect(result).toEqual({ ok: false, errors: { destination: "Choose a recipient", amount: "Enter an amount" } });
  });

  it("rejects malformed and zero amounts", () => {
    expect(validateDraft(draft({ amount: "12.345" }), ctx)).toMatchObject({ ok: false, errors: { amount: expect.stringContaining("valid") } });
    expect(validateDraft(draft({ amount: "0" }), ctx)).toMatchObject({ ok: false, errors: { amount: expect.stringContaining("greater than") } });
  });

  it("catches insufficient funds on the amount field", () => {
    expect(validateDraft(draft({ amount: "1000.01" }), ctx)).toMatchObject({ ok: false, errors: { amount: expect.stringContaining("Insufficient funds") } });
  });

  it("flags an unsupported method on the method field", () => {
    expect(validateDraft(draft({ payeeId: "py_atlas", method: "ach" }), ctx)).toMatchObject({ ok: false, errors: { method: expect.any(String) } });
  });

  it("validates internal transfers", () => {
    expect(validateDraft(draft({ kind: "internal", toAccountId: "" }), ctx)).toMatchObject({ ok: false, errors: { destination: expect.any(String) } });
    expect(validateDraft(draft({ kind: "internal", toAccountId: "a" }), ctx)).toMatchObject({ ok: false, errors: { destination: expect.stringContaining("different") } });
    expect(validateDraft(draft({ kind: "internal", toAccountId: "b" }), ctx)).toMatchObject({ ok: true });
  });

  it("rejects memos over 140 characters", () => {
    expect(validateDraft(draft({ memo: "x".repeat(141) }), ctx)).toMatchObject({ ok: false, errors: { memo: expect.any(String) } });
  });
});

describe("errorsFromTransferError", () => {
  it("maps server error codes onto fields, falling back to a form-level error", () => {
    expect(errorsFromTransferError({ code: "INSUFFICIENT_FUNDS", message: "m", field: "amountCents" })).toEqual({ amount: "m" });
    expect(errorsFromTransferError({ code: "METHOD_NOT_SUPPORTED", message: "m", field: "destination" })).toEqual({ method: "m" });
    expect(errorsFromTransferError({ code: "DEMO_LIMIT_REACHED", message: "m", field: null })).toEqual({ form: "m" });
  });
});
