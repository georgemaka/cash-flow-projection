import Decimal from "decimal.js";
import type {
  AnnualSpreadParams,
  PeriodValue,
  PriorYearPctParams,
  ProjectedValue,
  ProjectionInput,
  ProjectionResult
} from "./types";
import { toDecimal } from "./types";

// Configure Decimal.js for financial precision
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Main projection engine entry point.
 * Dispatches to the appropriate calculation method and returns projected values
 * for all target periods.
 */
export function calculateProjections(input: ProjectionInput): ProjectionResult {
  const { method, params, targetPeriods, priorYearValues } = input;

  let values: ProjectedValue[];

  switch (method) {
    case "manual":
      values = calculateManual(targetPeriods);
      break;
    case "annual_spread":
      values = calculateAnnualSpread(targetPeriods, params as AnnualSpreadParams);
      break;
    case "prior_year_pct":
      values = calculatePriorYearPct(
        targetPeriods,
        params as PriorYearPctParams,
        priorYearValues ?? []
      );
      break;
    case "prior_year_flat":
      values = calculatePriorYearFlat(targetPeriods, priorYearValues ?? []);
      break;
    default:
      throw new Error(`Unsupported projection method: ${method}`);
  }

  return { method, values };
}

/**
 * Manual: returns null for all periods.
 * User is expected to enter each value directly — the engine doesn't auto-fill.
 */
function calculateManual(targetPeriods: string[]): ProjectedValue[] {
  return targetPeriods.map((period) => ({
    period,
    projectedAmount: null
  }));
}

/**
 * Annual Spread: divides an annual total evenly across the target periods.
 *
 * To avoid rounding drift, the remainder (from integer division of cents)
 * is distributed one cent at a time to the earliest periods.
 *
 * Example: $100,000 across 12 months = $8,333.33 × 10 + $8,333.34 × 2 (first 2 months).
 */
function calculateAnnualSpread(
  targetPeriods: string[],
  params: AnnualSpreadParams
): ProjectedValue[] {
  if (targetPeriods.length === 0) return [];

  const total = new Decimal(params.annualTotal);
  const count = targetPeriods.length;

  // Calculate base amount per period (truncated to 2 decimal places)
  const baseAmount = total.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);

  // Calculate remainder in cents to distribute
  const totalDistributed = baseAmount.times(count);
  const remainderCents = total.minus(totalDistributed).times(100).toNumber();

  return targetPeriods.map((period, index) => {
    // Add one cent to the first `remainderCents` periods to make the total exact
    const adjustment = index < remainderCents ? new Decimal("0.01") : new Decimal("0");
    const amount = baseAmount.plus(adjustment);

    return {
      period,
      projectedAmount: amount.toFixed(2)
    };
  });
}

/**
 * Prior Year ± %: takes each prior year actual and applies a percentage adjustment.
 *
 * For each target period, looks up the corresponding prior-year period (same month, year - 1).
 * If prior year actual is null/missing, the projected value is null.
 *
 * pctChange of 5 means +5% (multiply by 1.05).
 * pctChange of -10 means -10% (multiply by 0.90).
 */
function calculatePriorYearPct(
  targetPeriods: string[],
  params: PriorYearPctParams,
  priorYearValues: PeriodValue[]
): ProjectedValue[] {
  const multiplier = new Decimal(1).plus(new Decimal(params.pctChange).dividedBy(100));
  const priorMap = buildPriorYearMap(priorYearValues);

  return targetPeriods.map((period) => {
    const priorPeriod = getPriorYearPeriod(period);
    const priorAmount = priorMap.get(priorPeriod);

    if (!priorAmount) {
      return { period, projectedAmount: null };
    }

    const projected = priorAmount.times(multiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
      period,
      projectedAmount: projected.toFixed(2)
    };
  });
}

/**
 * Prior Year Flat: copies prior year actuals exactly (0% change).
 *
 * For each target period, looks up the corresponding prior-year period.
 * If prior year actual is null/missing, the projected value is null.
 */
function calculatePriorYearFlat(
  targetPeriods: string[],
  priorYearValues: PeriodValue[]
): ProjectedValue[] {
  const priorMap = buildPriorYearMap(priorYearValues);

  return targetPeriods.map((period) => {
    const priorPeriod = getPriorYearPeriod(period);
    const priorAmount = priorMap.get(priorPeriod);

    if (!priorAmount) {
      return { period, projectedAmount: null };
    }

    return {
      period,
      projectedAmount: priorAmount.toFixed(2)
    };
  });
}

/**
 * Builds a lookup map from period string to Decimal amount.
 * Null amounts are excluded from the map.
 */
function buildPriorYearMap(values: PeriodValue[]): Map<string, Decimal> {
  const map = new Map<string, Decimal>();
  for (const v of values) {
    const amount = toDecimal(v.amount);
    if (amount !== null) {
      map.set(v.period, amount);
    }
  }
  return map;
}

/**
 * Given a target period "YYYY-MM", returns the prior year period "YYYY-1-MM".
 * Example: "2026-03" → "2025-03"
 */
function getPriorYearPeriod(period: string): string {
  const [yearStr, month] = period.split("-");
  const priorYear = parseInt(yearStr, 10) - 1;
  return `${priorYear}-${month}`;
}
