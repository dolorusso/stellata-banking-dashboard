import { describe, expect, it } from "vitest";
import { assertCents, centsToDecimalString, formatMoney, parseMoneyToCents, percentChange, sumCents } from "./money";

describe("parseMoneyToCents", () => {
  it.each([
    ["1234", 123_400],
    ["1234.5", 123_450],
    ["1234.56", 123_456],
    ["1,234.56", 123_456],
    ["$1,234,567.89", 123_456_789],
    ["$ 20", 2_000],
    ["0.01", 1],
    [".5", 50],
    ["  42.10  ", 4_210],
    ["1234.", 123_400],
  ])("parses %j → %i cents", (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it.each(["", "$", ".", "abc", "-5", "1.234", "1,23", "12,34.00", "1e5", "1 000", "9999999999999999"])(
    "rejects %j",
    (input) => {
      expect(parseMoneyToCents(input)).toBeNull();
    },
  );

  it("avoids float rounding errors", () => {
    // parseFloat("0.29") * 100 === 28.999999999999996
    expect(parseMoneyToCents("0.29")).toBe(29);
    expect(parseMoneyToCents("1.15")).toBe(115);
  });
});

describe("centsToDecimalString", () => {
  it.each([
    [0, "0.00"],
    [5, "0.05"],
    [-5, "-0.05"],
    [123_456, "1234.56"],
    [-100_000_000, "-1000000.00"],
  ])("%i → %s", (cents, expected) => {
    expect(centsToDecimalString(cents)).toBe(expected);
  });
});

describe("formatMoney", () => {
  it("formats cents as USD", () => {
    expect(formatMoney(123_456)).toBe("$1,234.56");
    expect(formatMoney(-5)).toBe("-$0.05");
  });

  it("supports explicit signs and compact notation", () => {
    expect(formatMoney(2_500, { signDisplay: "exceptZero" })).toBe("+$25.00");
    expect(formatMoney(125_000_000, { compact: true })).toBe("$1.3M");
  });

  it("refuses non-integer cents", () => {
    expect(() => formatMoney(10.5)).toThrow(RangeError);
  });
});

describe("sumCents / assertCents", () => {
  it("sums integer cents exactly", () => {
    expect(sumCents([10, 20, -5])).toBe(25);
    expect(sumCents([])).toBe(0);
  });

  it("rejects floats and unsafe integers", () => {
    expect(() => sumCents([1, 0.5])).toThrow(RangeError);
    expect(() => assertCents(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe("percentChange", () => {
  it("returns a ratio, or null when there is no baseline", () => {
    expect(percentChange(110, 100)).toBeCloseTo(0.1);
    expect(percentChange(-50, -100)).toBeCloseTo(0.5);
    expect(percentChange(5, 0)).toBeNull();
  });
});
