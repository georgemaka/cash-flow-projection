"use client";

import { useCallback, useEffect, useState } from "react";
import type { GridData, GridGroup, GridRow, PendingEdit } from "@/components/data-grid/types";
import { mergeEdits } from "./merge-edits";

/**
 * Thrown by saveEdits when the API returns 422 reason_required.
 * The caller should prompt the user for a reason and retry with it.
 */
export class ReasonRequiredError extends Error {
  constructor(
    public readonly threshold: number,
    public readonly delta: number,
    public readonly field: string
  ) {
    super("reason_required");
    this.name = "ReasonRequiredError";
  }
}

interface UseGridDataResult {
  data: GridData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  saveEdits: (edits: PendingEdit[], reason?: string) => Promise<void>;
}

/**
 * Fetches snapshot data and transforms it into the GridData shape
 * expected by the data grid components.
 */
export function useGridData(snapshotId: string | null): UseGridDataResult {
  const [data, setData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const reload = useCallback(() => {
    setReloadTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!snapshotId) {
      setData(null);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch snapshot, groups, and values in parallel
        const [snapshotRes, groupsRes, valuesRes] = await Promise.all([
          fetch(`/api/snapshots/${snapshotId}`),
          fetch("/api/groups"),
          fetch(`/api/values?snapshotId=${snapshotId}`)
        ]);

        if (cancelled) return;

        if (!snapshotRes.ok) throw new Error("Failed to fetch snapshot");
        if (!groupsRes.ok) throw new Error("Failed to fetch groups");
        if (!valuesRes.ok) throw new Error("Failed to fetch values");

        const snapshotJson = await snapshotRes.json();
        const groupsJson = await groupsRes.json();
        const valuesJson = await valuesRes.json();

        if (cancelled) return;

        const snapshot = snapshotJson.data ?? snapshotJson;
        const groups = groupsJson.data ?? groupsJson;
        const values = valuesJson.data ?? valuesJson;

        const gridData = assembleGridData(snapshot, groups, values);
        setData(gridData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [snapshotId, reloadTrigger]);

  const saveEdits = useCallback(
    async (edits: PendingEdit[], reason?: string) => {
      if (!snapshotId || edits.length === 0) return;

      // Group edits by lineItemId + period to merge projected/actual/note changes
      const merged = mergeEdits(edits);

      // Save each edit and read response body (needed to detect 422)
      const results = await Promise.all(
        merged.map(async (edit) => {
          const res = await fetch("/api/values/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lineItemId: edit.lineItemId,
              snapshotId,
              period: edit.period,
              projectedAmount: edit.projected !== undefined ? edit.projected : undefined,
              actualAmount: edit.actual !== undefined ? edit.actual : undefined,
              note: edit.note !== undefined ? edit.note : undefined,
              updatedBy: undefined, // Will be set by auth context when available
              ...(reason ? { reason } : {})
            })
          });
          const body = await res.json();
          return { status: res.status, body };
        })
      );

      // Surface the first material-change error so the UI can prompt for a reason
      const materialError = results.find(
        (r) => r.status === 422 && r.body.error === "reason_required"
      );
      if (materialError) {
        throw new ReasonRequiredError(
          materialError.body.threshold as number,
          materialError.body.delta as number,
          materialError.body.field as string
        );
      }

      const failed = results.filter((r) => r.status >= 400);
      if (failed.length > 0) {
        throw new Error(`Failed to save ${failed.length} value(s)`);
      }
    },
    [snapshotId]
  );

  return { data, loading, error, reload, saveEdits };
}

// ---------------------------------------------------------------------------
// Data assembly
// ---------------------------------------------------------------------------

interface SnapshotResponse {
  id: string;
  name: string;
  asOfMonth: string;
  status: "draft" | "locked";
}

interface GroupResponse {
  id: string;
  name: string;
  groupType: string;
  sortOrder: number;
  lineItems?: LineItemResponse[];
}

interface LineItemResponse {
  id: string;
  label: string;
  groupId: string;
  projectionMethod: string;
  sortOrder: number;
}

interface ValueResponse {
  lineItemId: string;
  period: string;
  projectedAmount: string | null;
  actualAmount: string | null;
  note: string | null;
  lineItem?: LineItemResponse;
}

function assembleGridData(
  snapshot: SnapshotResponse,
  groups: GroupResponse[],
  values: ValueResponse[]
): GridData {
  // Always generate all 12 months for the snapshot year, even if some
  // months have no data yet. This ensures the grid always shows the full year.
  const periodSet = new Set<string>();
  const year = new Date(snapshot.asOfMonth).getUTCFullYear();
  for (let m = 1; m <= 12; m++) {
    periodSet.add(`${year}-${String(m).padStart(2, "0")}`);
  }
  // Also include any periods from values that might fall outside the year
  for (const v of values) {
    const period = extractPeriod(v.period);
    if (period) periodSet.add(period);
  }

  const periods = Array.from(periodSet).sort();

  // Build value lookup: lineItemId -> period -> value
  const valueLookup = new Map<string, Map<string, ValueResponse>>();
  for (const v of values) {
    const period = extractPeriod(v.period);
    if (!period) continue;
    if (!valueLookup.has(v.lineItemId)) {
      valueLookup.set(v.lineItemId, new Map());
    }
    valueLookup.get(v.lineItemId)!.set(period, v);
  }

  // Build line items from values (since values include lineItem data)
  const lineItemsById = new Map<string, LineItemResponse>();
  for (const v of values) {
    if (v.lineItem && !lineItemsById.has(v.lineItemId)) {
      lineItemsById.set(v.lineItemId, v.lineItem);
    }
  }

  // Build grid groups
  const gridGroups: GridGroup[] = groups
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => {
      // Find line items for this group
      const groupLineItems = Array.from(lineItemsById.values())
        .filter((li) => li.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const rows: GridRow[] = groupLineItems.map((li) => {
        const itemValues = valueLookup.get(li.id) ?? new Map();
        const values: GridRow["values"] = {};
        for (const p of periods) {
          const v = itemValues.get(p);
          values[p] = {
            projected: v?.projectedAmount ?? null,
            actual: v?.actualAmount ?? null,
            note: v?.note ?? null,
            dirty: false
          };
        }
        return {
          lineItemId: li.id,
          label: li.label,
          projectionMethod: li.projectionMethod,
          groupId: li.groupId,
          values
        };
      });

      return {
        id: group.id,
        name: group.name,
        groupType: group.groupType,
        sortOrder: group.sortOrder,
        rows
      };
    })
    .filter((g) => g.rows.length > 0);

  return {
    snapshotId: snapshot.id,
    snapshotName: snapshot.name,
    snapshotStatus: snapshot.status,
    periods,
    groups: gridGroups
  };
}

/**
 * Extract a YYYY-MM string from various date formats
 * (ISO string, Date, or already formatted).
 */
function extractPeriod(raw: string | Date): string | null {
  if (!raw) return null;
  const str = typeof raw === "string" ? raw : raw.toISOString();
  // Try YYYY-MM format
  const shortMatch = /^(\d{4}-\d{2})$/.exec(str);
  if (shortMatch) return shortMatch[1];
  // Try ISO format
  const isoMatch = /^(\d{4})-(\d{2})/.exec(str);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  return null;
}
