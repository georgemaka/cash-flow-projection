"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { DataGridView } from "@/components/data-grid";
import type { PendingEdit } from "@/components/data-grid";
import { useGridData } from "@/lib/hooks/use-grid-data";
import "@/components/data-grid/data-grid.css";

export default function SnapshotDataEntryPage() {
  const params = useParams();
  const router = useRouter();
  const snapshotId = params.snapshotId as string;

  const { data, loading, error, reload, saveEdits } = useGridData(snapshotId);

  const handleSave = useCallback(
    async (edits: PendingEdit[], reason?: string) => {
      await saveEdits(edits, reason);
    },
    [saveEdits]
  );

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <button className="ghost-btn" onClick={() => router.push("/")} type="button">
          &larr; Back
        </button>
        {data && (
          <>
            <p className="eyebrow">Snapshot</p>
            <h1>{data.snapshotName}</h1>
            <p className="subhead">
              {data.snapshotStatus === "locked" ? "Locked — read only" : "Draft — editable"}
              {" \u00B7 "}
              {data.periods.length} months
              {" \u00B7 "}
              {data.groups.reduce((sum, g) => sum + g.rows.length, 0)} line items
            </p>
          </>
        )}
      </div>

      {loading && (
        <div className="cf-loading">
          <p>Loading snapshot data...</p>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button className="ghost-btn" onClick={reload} type="button">
            Retry
          </button>
        </div>
      )}

      {data && (
        <DataGridView data={data} editable={data.snapshotStatus === "draft"} onSave={handleSave} />
      )}
    </div>
  );
}
