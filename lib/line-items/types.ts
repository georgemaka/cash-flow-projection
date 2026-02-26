export type ProjectionMethod =
  | "manual"
  | "annual_spread"
  | "prior_year_pct"
  | "prior_year_flat"
  | "custom_formula";

export interface CreateLineItemInput {
  groupId: string;
  label: string;
  projectionMethod?: ProjectionMethod;
  projectionParams?: unknown;
  sortOrder?: number;
  createdBy: string | null;
}

export interface UpdateLineItemInput {
  lineItemId: string;
  groupId?: string;
  label?: string;
  projectionMethod?: ProjectionMethod;
  projectionParams?: unknown;
  sortOrder?: number;
  updatedBy: string | null;
  reason?: string;
}

export interface ArchiveLineItemInput {
  lineItemId: string;
  archivedBy: string | null;
  reason?: string;
}
