/**
 * Client-side types for the snapshot comparison view.
 * Mirror the server-side SnapshotCompareResult shape.
 */

export interface CompareCellData {
  aProjected: string | null;
  aActual: string | null;
  bProjected: string | null;
  bActual: string | null;
  projectedDelta: string | null;
  actualDelta: string | null;
}

export interface CompareRowData {
  lineItemId: string;
  label: string;
  projectionMethod: string;
  groupId: string;
  cells: Record<string, CompareCellData>;
}

export interface CompareGroupData {
  id: string;
  name: string;
  groupType: string;
  sortOrder: number;
  rows: CompareRowData[];
}

export interface CompareData {
  snapshotA: { id: string; name: string; status: string };
  snapshotB: { id: string; name: string; status: string };
  periods: string[];
  groups: CompareGroupData[];
}

/** Format a delta value for display: +1,234 / (1,234) / — */
export function formatDelta(delta: string | null): string {
  if (delta === null) return "\u2014";
  const num = parseFloat(delta);
  if (isNaN(num) || num === 0) return "\u2014";
  const abs = Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return num > 0 ? `+${abs}` : `(${abs})`;
}

/** CSS class for a delta value */
export function deltaClass(delta: string | null): string {
  if (delta === null) return "";
  const num = parseFloat(delta);
  if (isNaN(num) || num === 0) return "";
  return num > 0 ? "cmp-delta-pos" : "cmp-delta-neg";
}

/** Format a currency value for display */
export function formatAmount(value: string | null): string {
  if (value === null || value === "") return "\u2014";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (num < 0) {
    return `(${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
  }
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Format a YYYY-MM period to short label */
export function formatPeriod(period: string): string {
  const months = [
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
  ];
  const [yearStr, monthStr] = period.split("-");
  return `${months[parseInt(monthStr, 10) - 1]} ${yearStr.slice(2)}`;
}
