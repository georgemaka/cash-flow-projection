import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatPeriodLabel,
  parseCurrencyInput
} from "../../components/data-grid/types";

describe("formatPeriodLabel", () => {
  it("formats YYYY-MM to short label", () => {
    expect(formatPeriodLabel("2027-01")).toBe("Jan 27");
    expect(formatPeriodLabel("2027-06")).toBe("Jun 27");
    expect(formatPeriodLabel("2027-12")).toBe("Dec 27");
  });

  it("handles different years", () => {
    expect(formatPeriodLabel("2030-03")).toBe("Mar 30");
  });
});

describe("formatCurrency", () => {
  it("formats positive numbers with commas", () => {
    expect(formatCurrency("10000.00")).toBe("10,000");
    expect(formatCurrency("1234567.89")).toBe("1,234,568");
  });

  it("formats negative numbers in parentheses", () => {
    expect(formatCurrency("-5000.00")).toBe("(5,000)");
    expect(formatCurrency("-123.45")).toBe("(123)");
  });

  it("returns em-dash for null", () => {
    expect(formatCurrency(null)).toBe("\u2014");
  });

  it("returns em-dash for empty string", () => {
    expect(formatCurrency("")).toBe("\u2014");
  });

  it("formats zero", () => {
    expect(formatCurrency("0")).toBe("0");
    expect(formatCurrency("0.00")).toBe("0");
  });

  it("handles non-numeric strings", () => {
    expect(formatCurrency("abc")).toBe("abc");
  });
});

describe("parseCurrencyInput", () => {
  it("parses plain numbers", () => {
    expect(parseCurrencyInput("10000")).toBe("10000.00");
    expect(parseCurrencyInput("123.45")).toBe("123.45");
  });

  it("parses numbers with commas", () => {
    expect(parseCurrencyInput("10,000")).toBe("10000.00");
    expect(parseCurrencyInput("1,234,567.89")).toBe("1234567.89");
  });

  it("parses numbers with dollar sign", () => {
    expect(parseCurrencyInput("$10000")).toBe("10000.00");
    expect(parseCurrencyInput("$1,234.56")).toBe("1234.56");
  });

  it("parses negative values in parentheses", () => {
    expect(parseCurrencyInput("(5000)")).toBe("-5000.00");
    expect(parseCurrencyInput("(1,234.56)")).toBe("-1234.56");
  });

  it("returns null for empty input", () => {
    expect(parseCurrencyInput("")).toBeNull();
    expect(parseCurrencyInput("   ")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseCurrencyInput("abc")).toBeNull();
  });

  it("handles whitespace", () => {
    expect(parseCurrencyInput(" 100 ")).toBe("100.00");
  });
});
