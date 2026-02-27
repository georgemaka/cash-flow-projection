/**
 * Client-side types for the data grid UI.
 * These represent the shape of data after it's been fetched from the API
 * and restructured for the grid component.
 */

/** A single cell value in the grid (one line item × one month). */
export interface CellValue {
  projected: string | null;
  actual: string | null;
  note: string | null;
  /** True if this cell has been modified since last save. */
  dirty: boolean;
}

/** A row in the grid representing one line item. */
export interface GridRow {
  lineItemId: string;
  label: string;
  projectionMethod: string;
  groupId: string;
  /** Values keyed by period string (YYYY-MM). */
  values: Record<string, CellValue>;
}

/** A group of rows in the grid. */
export interface GridGroup {
  id: string;
  name: string;
  groupType: string;
  sortOrder: number;
  rows: GridRow[];
}

/** The full grid data model. */
export interface GridData {
  snapshotId: string;
  snapshotName: string;
  snapshotStatus: "draft" | "locked";
  periods: string[];
  groups: GridGroup[];
}

/** Pending cell edit to be saved. */
export interface PendingEdit {
  lineItemId: string;
  period: string;
  field: "projected" | "actual" | "note";
  value: string | null;
}

/** View mode options for the data grid. */
export type ViewMode = "combined" | "projected" | "actual" | "variance";

/**
 * Determine whether a period (YYYY-MM) is in the past relative to today.
 * A month is "past" if it's before the current month.
 */
export function isPastPeriod(period: string): boolean {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return period < currentPeriod;
}

/**
 * For the combined view: pick the best value to display.
 * If an actual exists, always prefer it. Otherwise fall back to projected.
 */
export function getCombinedValue(
  cell: CellValue,
  _period: string
): { value: string | null; source: "actual" | "projected" } {
  if (cell.actual !== null) {
    return { value: cell.actual, source: "actual" };
  }
  return { value: cell.projected, source: "projected" };
}

/** Month labels for display. */
export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

/** Format a YYYY-MM period string to a short label like "Jan 27". */
export function formatPeriodLabel(period: string): string {
  const [yearStr, monthStr] = period.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  const yearShort = yearStr.slice(2);
  return `${MONTH_LABELS[monthIndex]} ${yearShort}`;
}

/** Format a number as currency string for display. */
export function formatCurrency(value: string | null): string {
  if (value === null || value === "") return "\u2014"; // em-dash
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (num < 0) {
    return `(${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
  }
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Parse a user-entered currency string to a plain number string. */
export function parseCurrencyInput(input: string): string | null {
  if (!input || !input.trim()) return null;
  // Remove currency symbols, commas, spaces
  let cleaned = input.replace(/[$,\s]/g, "");
  // Handle parentheses as negative
  const parenMatch = /^\((.+)\)$/.exec(cleaned);
  if (parenMatch) {
    cleaned = `-${parenMatch[1]}`;
  }
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return num.toFixed(2);
}
