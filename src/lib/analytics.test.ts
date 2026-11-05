import { describe, expect, it } from "vitest";
import { buildOverview } from "./analytics";
import { buildLedger, createTransfer } from "./ledger";
import { ACCOUNT_IDS } from "./seed";
import { EMPTY_DEMO_STATE } from "./schemas";

const NOW = new Date("2026-11-05T15:00:00.000Z");
const ledger = buildLedger(EMPTY_DEMO_STATE, NOW);

describe("buildOverview", () => {
  it("covers exactly the requested range, ending today", () => {
    const o = buildOverview(ledger, "30d");
    expect(o.from).toBe("2026-10-07");
    expect(o.to).toBe("2026-11-05");
    expect(o.balanceTrend).toHaveLength(30);
    expect(o.cashFlow).toHaveLength(30); // daily buckets
    expect(buildOverview(ledger, "90d").cashFlow).toHaveLength(13); // weekly
    expect(buildOverview(ledger, "180d").cashFlow).toHaveLength(6); // ~monthly
  });

  it("keeps flows consistent: buckets sum to the totals and net = in − out", () => {
    for (const range of ["30d", "90d", "180d"] as const) {
      const o = buildOverview(ledger, range);
      expect(o.flows.netCents).toBe(o.flows.inCents - o.flows.outCents);
      expect(o.cashFlow.reduce((s, b) => s + b.inCents, 0)).toBe(o.flows.inCents);
      expect(o.cashFlow.reduce((s, b) => s + b.outCents, 0)).toBe(o.flows.outCents);
    }
  });

  it("ends the balance trend at the current total balance", () => {
    const o = buildOverview(ledger, "90d");
    expect(o.balanceTrend.at(-1)?.balanceCents).toBe(o.totalBalanceCents);
  });

  it("excludes internal transfers from money in/out and spending", () => {
    const o = buildOverview(ledger, "180d");
    expect(o.spending.some((s) => s.category === "transfer")).toBe(false);

    const result = createTransfer(
      EMPTY_DEMO_STATE,
      { fromAccountId: ACCOUNT_IDS.operating, destination: { kind: "internal", toAccountId: ACCOUNT_IDS.tax }, amountCents: 500_000 },
      NOW,
    );
    if (!result.ok) throw new Error(result.error.message);
    const after = buildOverview(result.ledger, "30d");
    expect(after.flows).toEqual(buildOverview(ledger, "30d").flows);
    expect(after.totalBalanceCents).toBe(o.totalBalanceCents);
  });

  it("compares with the previous period only when history covers it", () => {
    expect(buildOverview(ledger, "30d").previousFlows).not.toBeNull();
    expect(buildOverview(ledger, "90d").previousFlows).not.toBeNull();
    expect(buildOverview(ledger, "180d").previousFlows).toBeNull();
  });

  it("derives burn and runway from net outflow", () => {
    const o = buildOverview(ledger, "90d");
    if (o.flows.netCents < 0) {
      expect(o.monthlyBurnCents).toBe(Math.round((-o.flows.netCents * 30) / 90));
      expect(o.runwayMonths).toBeCloseTo(o.totalBalanceCents / o.monthlyBurnCents);
    } else {
      expect(o.monthlyBurnCents).toBe(0);
      expect(o.runwayMonths).toBeNull();
    }
  });
});
