/**
 * Data shape expected by the Excel export service.
 * This is what the caller assembles from Prisma data before handing off.
 */

export interface ExportLineItem {
  label: string;
  /** Monthly values keyed by YYYY-MM period string */
  values: Record<string, { projected: string | null; actual: string | null }>;
}

export interface ExportGroup {
  name: string;
  groupType: "sector" | "non_operating" | "custom";
  lineItems: ExportLineItem[];
}

export interface ExportSnapshotData {
  snapshotName: string;
  asOfMonth: string; // YYYY-MM
  companyName: string;
  /** Calendar year periods in order, e.g. ["2026-01", "2026-02", ..., "2026-12"] */
  periods: string[];
  /** Groups in display order */
  groups: ExportGroup[];
}

/**
 * Format a YYYY-MM period into a short month label (e.g., "Jan", "Feb").
 */
export function formatPeriodShort(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

/**
 * Format a YYYY-MM period into "Jan 2026" style label.
 */
export function formatPeriodLong(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
