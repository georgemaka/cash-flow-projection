import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { calculateProjections } from "../../lib/calculations";
import type { PeriodValue, ProjectionInput } from "../../lib/calculations";

// Helper: generate YYYY-MM strings for a full year
function fullYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}

// Helper: sum all non-null projected amounts
function sumProjected(values: { projectedAmount: string | null }[]): string {
  return values
    .reduce((acc, v) => {
      if (v.projectedAmount === null) return acc;
      return acc.plus(new Decimal(v.projectedAmount));
    }, new Decimal(0))
    .toFixed(2);
}

// ---------------------------------------------------------------------------
// Manual method
// ---------------------------------------------------------------------------
describe("manual projection", () => {
  it("returns null for all target periods", () => {
    const input: ProjectionInput = {
      method: "manual",
      params: {},
      targetPeriods: fullYear(2026)
    };

    const result = calculateProjections(input);

    expect(result.method).toBe("manual");
    expect(result.values).toHaveLength(12);
    for (const v of result.values) {
      expect(v.projectedAmount).toBeNull();
    }
  });

  it("handles empty target periods", () => {
    const result = calculateProjections({
      method: "manual",
      params: {},
      targetPeriods: []
    });

    expect(result.values).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Annual spread method
// ---------------------------------------------------------------------------
describe("annual_spread projection", () => {
  it("divides $120,000 evenly across 12 months", () => {
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "120000" },
      targetPeriods: fullYear(2026)
    });

    expect(result.method).toBe("annual_spread");
    expect(result.values).toHaveLength(12);

    for (const v of result.values) {
      expect(v.projectedAmount).toBe("10000.00");
    }

    expect(sumProjected(result.values)).toBe("120000.00");
  });

  it("distributes remainder cents to earliest periods for $100,000 / 12", () => {
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "100000" },
      targetPeriods: fullYear(2026)
    });

    // $100,000 / 12 = $8,333.333...
    // Base: $8,333.33 × 12 = $99,999.96
    // Remainder: $0.04 = 4 cents → first 4 months get $8,333.34
    const values = result.values;
    for (let i = 0; i < 4; i++) {
      expect(values[i].projectedAmount).toBe("8333.34");
    }
    for (let i = 4; i < 12; i++) {
      expect(values[i].projectedAmount).toBe("8333.33");
    }

    // Total must be exact
    expect(sumProjected(values)).toBe("100000.00");
  });

  it("handles partial year (6 months)", () => {
    const periods = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "60000" },
      targetPeriods: periods
    });

    expect(result.values).toHaveLength(6);
    for (const v of result.values) {
      expect(v.projectedAmount).toBe("10000.00");
    }
    expect(sumProjected(result.values)).toBe("60000.00");
  });

  it("handles single month", () => {
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "50000" },
      targetPeriods: ["2026-01"]
    });

    expect(result.values).toHaveLength(1);
    expect(result.values[0].projectedAmount).toBe("50000.00");
  });

  it("handles zero annual total", () => {
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "0" },
      targetPeriods: fullYear(2026)
    });

    for (const v of result.values) {
      expect(v.projectedAmount).toBe("0.00");
    }
  });

  it("handles negative annual total (net expense)", () => {
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "-12000" },
      targetPeriods: fullYear(2026)
    });

    for (const v of result.values) {
      expect(v.projectedAmount).toBe("-1000.00");
    }
    expect(sumProjected(result.values)).toBe("-12000.00");
  });

  it("handles empty target periods", () => {
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "120000" },
      targetPeriods: []
    });

    expect(result.values).toHaveLength(0);
  });

  it("handles large amounts without floating-point errors", () => {
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "9999999.99" },
      targetPeriods: fullYear(2026)
    });

    expect(sumProjected(result.values)).toBe("9999999.99");
  });

  it("handles small amount with many remainder cents", () => {
    // $1.00 / 12 = $0.08 base, $0.04 remainder → first 4 months get $0.09
    const result = calculateProjections({
      method: "annual_spread",
      params: { annualTotal: "1.00" },
      targetPeriods: fullYear(2026)
    });

    expect(sumProjected(result.values)).toBe("1.00");
  });
});

// ---------------------------------------------------------------------------
// Prior year ± % method
// ---------------------------------------------------------------------------
describe("prior_year_pct projection", () => {
  const priorYearValues: PeriodValue[] = fullYear(2025).map((period, i) => ({
    period,
    amount: String((i + 1) * 1000) // Jan=1000, Feb=2000, ..., Dec=12000
  }));

  it("applies +5% to prior year actuals", () => {
    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 5 },
      targetPeriods: fullYear(2026),
      priorYearValues
    });

    expect(result.method).toBe("prior_year_pct");
    expect(result.values).toHaveLength(12);

    // Jan 2026: 1000 * 1.05 = 1050.00
    expect(result.values[0].projectedAmount).toBe("1050.00");
    expect(result.values[0].period).toBe("2026-01");

    // Dec 2026: 12000 * 1.05 = 12600.00
    expect(result.values[11].projectedAmount).toBe("12600.00");
  });

  it("applies -10% to prior year actuals", () => {
    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: -10 },
      targetPeriods: fullYear(2026),
      priorYearValues
    });

    // Jan 2026: 1000 * 0.90 = 900.00
    expect(result.values[0].projectedAmount).toBe("900.00");

    // Jun 2026: 6000 * 0.90 = 5400.00
    expect(result.values[5].projectedAmount).toBe("5400.00");
  });

  it("applies 0% (same as flat)", () => {
    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 0 },
      targetPeriods: fullYear(2026),
      priorYearValues
    });

    for (let i = 0; i < 12; i++) {
      expect(result.values[i].projectedAmount).toBe(String((i + 1) * 1000) + ".00");
    }
  });

  it("returns null for periods with no prior year data", () => {
    // Only provide Jan and Feb prior year data
    const partialPrior: PeriodValue[] = [
      { period: "2025-01", amount: "5000" },
      { period: "2025-02", amount: "6000" }
    ];

    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 10 },
      targetPeriods: fullYear(2026),
      priorYearValues: partialPrior
    });

    expect(result.values[0].projectedAmount).toBe("5500.00"); // 5000 * 1.10
    expect(result.values[1].projectedAmount).toBe("6600.00"); // 6000 * 1.10
    for (let i = 2; i < 12; i++) {
      expect(result.values[i].projectedAmount).toBeNull();
    }
  });

  it("returns null when prior year value is null", () => {
    const priorWithNull: PeriodValue[] = [
      { period: "2025-01", amount: null },
      { period: "2025-02", amount: "3000" }
    ];

    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 5 },
      targetPeriods: ["2026-01", "2026-02"],
      priorYearValues: priorWithNull
    });

    expect(result.values[0].projectedAmount).toBeNull();
    expect(result.values[1].projectedAmount).toBe("3150.00");
  });

  it("handles empty prior year values", () => {
    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 5 },
      targetPeriods: fullYear(2026),
      priorYearValues: []
    });

    for (const v of result.values) {
      expect(v.projectedAmount).toBeNull();
    }
  });

  it("handles fractional percentage (2.5%)", () => {
    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 2.5 },
      targetPeriods: ["2026-01"],
      priorYearValues: [{ period: "2025-01", amount: "10000" }]
    });

    // 10000 * 1.025 = 10250.00
    expect(result.values[0].projectedAmount).toBe("10250.00");
  });

  it("handles negative prior year amount (refund/credit scenario)", () => {
    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 10 },
      targetPeriods: ["2026-03"],
      priorYearValues: [{ period: "2025-03", amount: "-2000" }]
    });

    // -2000 * 1.10 = -2200.00
    expect(result.values[0].projectedAmount).toBe("-2200.00");
  });

  it("handles rounding correctly for amounts that produce repeating decimals", () => {
    const result = calculateProjections({
      method: "prior_year_pct",
      params: { pctChange: 33.33 },
      targetPeriods: ["2026-01"],
      priorYearValues: [{ period: "2025-01", amount: "100" }]
    });

    // 100 * 1.3333 = 133.33
    expect(result.values[0].projectedAmount).toBe("133.33");
  });
});

// ---------------------------------------------------------------------------
// Prior year flat method
// ---------------------------------------------------------------------------
describe("prior_year_flat projection", () => {
  const priorYearValues: PeriodValue[] = fullYear(2025).map((period, i) => ({
    period,
    amount: String((i + 1) * 2500) // Jan=2500, Feb=5000, ..., Dec=30000
  }));

  it("copies prior year values exactly", () => {
    const result = calculateProjections({
      method: "prior_year_flat",
      params: {},
      targetPeriods: fullYear(2026),
      priorYearValues
    });

    expect(result.method).toBe("prior_year_flat");
    expect(result.values).toHaveLength(12);

    for (let i = 0; i < 12; i++) {
      expect(result.values[i].projectedAmount).toBe(String((i + 1) * 2500) + ".00");
    }
  });

  it("returns null for missing prior year periods", () => {
    const result = calculateProjections({
      method: "prior_year_flat",
      params: {},
      targetPeriods: fullYear(2026),
      priorYearValues: [{ period: "2025-06", amount: "15000" }]
    });

    for (let i = 0; i < 12; i++) {
      if (i === 5) {
        expect(result.values[i].projectedAmount).toBe("15000.00");
      } else {
        expect(result.values[i].projectedAmount).toBeNull();
      }
    }
  });

  it("handles empty prior year data", () => {
    const result = calculateProjections({
      method: "prior_year_flat",
      params: {},
      targetPeriods: fullYear(2026),
      priorYearValues: []
    });

    for (const v of result.values) {
      expect(v.projectedAmount).toBeNull();
    }
  });

  it("handles null amounts in prior year", () => {
    const result = calculateProjections({
      method: "prior_year_flat",
      params: {},
      targetPeriods: ["2026-01", "2026-02"],
      priorYearValues: [
        { period: "2025-01", amount: null },
        { period: "2025-02", amount: "8000" }
      ]
    });

    expect(result.values[0].projectedAmount).toBeNull();
    expect(result.values[1].projectedAmount).toBe("8000.00");
  });

  it("preserves decimal precision from prior year", () => {
    const result = calculateProjections({
      method: "prior_year_flat",
      params: {},
      targetPeriods: ["2026-01"],
      priorYearValues: [{ period: "2025-01", amount: "1234.56" }]
    });

    expect(result.values[0].projectedAmount).toBe("1234.56");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("projection engine error handling", () => {
  it("throws on unsupported projection method", () => {
    expect(() =>
      calculateProjections({
        method: "nonexistent" as never,
        params: {},
        targetPeriods: ["2026-01"]
      })
    ).toThrow("Unsupported projection method: nonexistent");
  });
});
