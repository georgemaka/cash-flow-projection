import type { PendingEdit } from "@/components/data-grid/types";

export interface MergedEdit {
  lineItemId: string;
  period: string;
  projected?: string | null;
  actual?: string | null;
  note?: string | null;
}

/**
 * Collapses a flat list of PendingEdits (one per field change) into a map of
 * merged edits keyed by "lineItemId:period".  Later edits for the same field
 * win; fields not touched in the batch are left as `undefined` so callers can
 * omit them from the API payload.
 */
export function mergeEdits(edits: PendingEdit[]): MergedEdit[] {
  const map = new Map<string, MergedEdit>();

  for (const edit of edits) {
    const key = `${edit.lineItemId}:${edit.period}`;
    const existing = map.get(key) ?? { lineItemId: edit.lineItemId, period: edit.period };
    if (edit.field === "projected") {
      existing.projected = edit.value;
    } else if (edit.field === "actual") {
      existing.actual = edit.value;
    } else {
      existing.note = edit.value;
    }
    map.set(key, existing);
  }

  return Array.from(map.values());
}
