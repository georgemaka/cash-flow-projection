import Decimal from "decimal.js";

export const FIXED_THRESHOLD = 1000;
export const PCT_THRESHOLD = 0.05;

/**
 * Returns the material-change threshold for a given old value.
 * threshold = max($1,000, 5% of |oldValue|)  — per ADR-005.
 */
export function materialChangeThreshold(oldValue: Decimal): number {
  const pct = oldValue.abs().mul(PCT_THRESHOLD).toNumber();
  return Math.max(FIXED_THRESHOLD, pct);
}

/**
 * Checks whether a field change is material and therefore requires a reason note.
 * Returns { isMaterial: false } when the change is exempt (null old value, null new value,
 * or no actual movement).
 */
export function checkMaterialChange(
  oldAmount: Decimal | null,
  newAmount: Decimal | null
): { isMaterial: boolean; threshold: number; delta: number } {
  // New record or clearing a value — exempt
  if (oldAmount === null || newAmount === null) {
    return { isMaterial: false, threshold: 0, delta: 0 };
  }
  // No change
  if (oldAmount.equals(newAmount)) {
    return { isMaterial: false, threshold: 0, delta: 0 };
  }

  const delta = newAmount.minus(oldAmount).abs().toNumber();
  const threshold = materialChangeThreshold(oldAmount);
  return { isMaterial: delta > threshold, threshold, delta };
}

export class MaterialChangeRequiredError extends Error {
  readonly code = "reason_required" as const;

  constructor(
    public readonly field: "projectedAmount" | "actualAmount",
    public readonly threshold: number,
    public readonly delta: number
  ) {
    super("reason_required");
    this.name = "MaterialChangeRequiredError";
  }
}
