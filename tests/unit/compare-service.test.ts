import { describe, expect, it } from "vitest";
import { computeDelta } from "@/lib/snapshots/compare-service";
import { deltaClass, formatDelta } from "@/components/snapshot-compare/types";

describe("computeDelta", () => {
  it("returns null when both values are null", () => {
    expect(computeDelta(null, null)).toBeNull();
  });

  it("returns b when a is null (treat a as 0)", () => {
    expect(computeDelta(null, "1000.00")).toBe("1000.00");
  });

  it("returns negative of a when b is null (treat b as 0)", () => {
    expect(computeDelta("1000.00", null)).toBe("-1000.00");
  });

  it("computes positive delta", () => {
    expect(computeDelta("1000.00", "1500.00")).toBe("500.00");
  });

  it("computes negative delta", () => {
    expect(computeDelta("2000.00", "1800.00")).toBe("-200.00");
  });

  it("returns zero-valued string when values are equal", () => {
    expect(computeDelta("5000.00", "5000.00")).toBe("0.00");
  });

  it("handles decimal precision correctly", () => {
    expect(computeDelta("100.50", "200.75")).toBe("100.25");
  });

  it("handles negative input values", () => {
    // b=-500, a=-1000 → delta = +500
    expect(computeDelta("-1000.00", "-500.00")).toBe("500.00");
  });
});

describe("formatDelta", () => {
  it("returns em-dash for null delta", () => {
    expect(formatDelta(null)).toBe("\u2014");
  });

  it("returns em-dash for zero delta", () => {
    expect(formatDelta("0.00")).toBe("\u2014");
  });

  it("formats positive delta with + prefix", () => {
    expect(formatDelta("1500.00")).toBe("+1,500");
  });

  it("formats negative delta in parentheses", () => {
    expect(formatDelta("-2000.00")).toBe("(2,000)");
  });

  it("rounds to integer", () => {
    expect(formatDelta("999.75")).toBe("+1,000");
  });
});

describe("deltaClass", () => {
  it("returns empty string for null", () => {
    expect(deltaClass(null)).toBe("");
  });

  it("returns empty string for zero", () => {
    expect(deltaClass("0.00")).toBe("");
  });

  it("returns positive class for positive delta", () => {
    expect(deltaClass("500.00")).toBe("cmp-delta-pos");
  });

  it("returns negative class for negative delta", () => {
    expect(deltaClass("-500.00")).toBe("cmp-delta-neg");
  });
});
