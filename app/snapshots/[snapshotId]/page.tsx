"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCallback } from "react";
import { DataGridView } from "@/components/data-grid";
import type { PendingEdit } from "@/components/data-grid";
import { useGridData } from "@/lib/hooks/use-grid-data";
import { Skeleton } from "@/components/ui/Skeleton";
import "@/components/data-grid/data-grid.css";

export default function SnapshotDataEntryPage() {
  const params = useParams();
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
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link href="/" className="breadcrumb-link">Dashboard</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">
          {data ? data.snapshotName : "Snapshot"}
        </span>
      </nav>

      {data && (
        <div className="dashboard-header">
          <div className="detail-header">
            <div>
              <h1>{data.snapshotName}</h1>
              <div className="detail-meta">
                <span
                  className={`detail-status ${
                    data.snapshotStatus === "locked"
                      ? "detail-status-locked"
                      : "detail-status-draft"
                  }`}
                >
                  {data.snapshotStatus === "locked" ? "\uD83D\uDD12 Locked \u2014 read only" : "\u270F\uFE0F Draft \u2014 editable"}
                </span>
                <span className="detail-meta-item">
                  {data.periods.length} months
                </span>
                <span className="detail-meta-item">
                  {data.groups.reduce((sum, g) => sum + g.rows.length, 0)} line items
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
          <Skeleton width="30%" height="1.5rem" />
          <Skeleton width="100%" height="2.5rem" />
          <Skeleton width="100%" height="300px" borderRadius="14px" />
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
        <DataGridView
          data={data}
          editable={data.snapshotStatus === "draft"}
          onSave={handleSave}
          onReload={reload}
        />
      )}
    </div>
  );
}
