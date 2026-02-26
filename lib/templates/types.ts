/**
 * Template onboarding types.
 *
 * Template onboarding creates a new fiscal year snapshot from a prior-year
 * locked snapshot. It copies the group/line-item structure and uses the
 * projection engine to pre-fill projected values. Actuals are NOT copied
 * (ADR-003: new snapshots start fresh for actuals).
 */

/** Preview of what onboarding will create, shown for admin confirmation. */
export interface TemplatePreview {
  sourceSnapshot: {
    id: string;
    name: string;
    asOfMonth: string;
  };
  targetYear: number;
  targetPeriods: string[];
  groups: TemplateGroupPreview[];
  summary: {
    totalGroups: number;
    totalLineItems: number;
    totalValues: number;
  };
}

export interface TemplateGroupPreview {
  id: string;
  name: string;
  groupType: string;
  sortOrder: number;
  lineItems: TemplateLineItemPreview[];
}

export interface TemplateLineItemPreview {
  id: string;
  label: string;
  projectionMethod: string;
  projectionParams: unknown;
  /** Sum of prior-year actuals from the source snapshot (null if no actuals). */
  priorYearTotal: string | null;
}

/** Input for creating a new year from a template. */
export interface OnboardFromTemplateInput {
  sourceSnapshotId: string;
  /** Name for the new snapshot, e.g., "2027 Cash Flow Projection" */
  name: string;
  /** Target fiscal year, e.g., 2027 */
  targetYear: number;
  createdBy: string;
}

/** Generates 12 period strings for a fiscal year: "YYYY-01" through "YYYY-12". */
export function generateFiscalYearPeriods(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}
