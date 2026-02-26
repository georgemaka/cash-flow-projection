/**
 * Input for creating a new snapshot.
 */
export interface CreateSnapshotInput {
  name: string;
  /** YYYY-MM format, e.g., "2026-03" */
  asOfMonth: string;
  createdBy: string;
}

/**
 * Input for locking a snapshot (admin-only).
 */
export interface LockSnapshotInput {
  snapshotId: string;
  lockedBy: string;
  reason?: string;
}

/**
 * Input for unlocking a snapshot (admin-only).
 */
export interface UnlockSnapshotInput {
  snapshotId: string;
  unlockedBy: string;
  reason?: string;
}

/**
 * Input for copying a snapshot from a prior locked version.
 * Creates a new draft snapshot pre-filled with the source's projected values.
 * Actual amounts are NOT copied (per ADR-003: new snapshots start fresh for actuals).
 */
export interface CopySnapshotInput {
  sourceSnapshotId: string;
  name: string;
  /** YYYY-MM format for the new snapshot's as-of month */
  asOfMonth: string;
  createdBy: string;
}

/**
 * Converts a YYYY-MM string to a Date (first day of the month, UTC).
 */
export function parseAsOfMonth(asOfMonth: string): Date {
  const [year, month] = asOfMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}
