export interface ListValuesInput {
  snapshotId: string;
  groupId?: string;
}

export interface UpsertValueInput {
  lineItemId: string;
  snapshotId: string;
  /** YYYY-MM */
  period: string;
  projectedAmount?: string | null;
  actualAmount?: string | null;
  note?: string | null;
  updatedBy: string | null;
  reason?: string;
}
