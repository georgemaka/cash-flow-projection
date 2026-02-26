import Decimal from "decimal.js";

/**
 * Supported projection methods.
 * Must stay in sync with ProjectionMethod enum in prisma/schema.prisma.
 */
export type ProjectionMethod = "manual" | "annual_spread" | "prior_year_pct" | "prior_year_flat";

/** Parameters for annual_spread: total amount to divide across periods. */
export interface AnnualSpreadParams {
  annualTotal: string; // Decimal-safe string representation
}

/** Parameters for prior_year_pct: percentage adjustment applied to prior year actuals. */
export interface PriorYearPctParams {
  pctChange: number; // e.g., 5 means +5%, -10 means -10%
}

/** prior_year_flat has no additional params (copies prior year exactly). */
export type PriorYearFlatParams = Record<string, never>;

/** manual has no additional params (user enters each month directly). */
export type ManualParams = Record<string, never>;

export type ProjectionParams =
  | AnnualSpreadParams
  | PriorYearPctParams
  | PriorYearFlatParams
  | ManualParams;

/** A single period's value used as input (prior year actuals). */
export interface PeriodValue {
  /** Period identifier as YYYY-MM string, e.g., "2025-03" */
  period: string;
  /** Actual amount for that period. Null means no data available. */
  amount: string | null;
}

/** A single projected output for a period. */
export interface ProjectedValue {
  /** Period identifier as YYYY-MM string, e.g., "2026-03" */
  period: string;
  /** Projected amount as Decimal-safe string. Null if cannot be calculated. */
  projectedAmount: string | null;
}

/** Input to the projection engine. */
export interface ProjectionInput {
  method: ProjectionMethod;
  params: ProjectionParams;
  /** Target periods to generate projections for (YYYY-MM strings). */
  targetPeriods: string[];
  /** Prior year actuals, required for prior_year_pct and prior_year_flat methods. */
  priorYearValues?: PeriodValue[];
}

/** Output from the projection engine. */
export interface ProjectionResult {
  method: ProjectionMethod;
  values: ProjectedValue[];
}

/** Helper to create a Decimal from a string or return null. */
export function toDecimal(value: string | null): Decimal | null {
  if (value === null || value === "") return null;
  return new Decimal(value);
}
