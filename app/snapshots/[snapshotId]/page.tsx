"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useState } from "react";
import { DataGridView } from "@/components/data-grid";
import type { PendingEdit } from "@/components/data-grid";
import { useGridData } from "@/lib/hooks/use-grid-data";
import { useToast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import "@/components/data-grid/data-grid.css";

export default function SnapshotDataEntryPage() {
  const params = useParams();
  const snapshotId = params.snapshotId as string;
  const { toast } = useToast();
  const [locking, setLocking] = useState(false);

  const { data, loading, error, reload, saveEdits } = useGridData(snapshotId);

  const handleSave = useCallback(
    async (edits: PendingEdit[], reason?: string) => {
      await saveEdits(edits, reason);
    },
    [saveEdits]
  );

  const handleLock = useCallback(async () => {
    if (!confirm("Lock this snapshot? It will become read-only until unlocked.")) return;
    setLocking(true);
    try {
      const res = await fetch("/api/snapshots/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, lockedBy: "admin" }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to lock");
      }
      toast("Snapshot locked", "success");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Lock failed", "error");
    } finally {
      setLocking(false);
    }
  }, [snapshotId, reload, toast]);

  const handleUnlock = useCallback(async () => {
    if (!confirm("Unlock this snapshot? It will become editable again.")) return;
    setLocking(true);
    try {
      const res = await fetch("/api/snapshots/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, unlockedBy: "admin" }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to unlock");
      }
      toast("Snapshot unlocked", "success");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unlock failed", "error");
    } finally {
      setLocking(false);
    }
  }, [snapshotId, reload, toast]);

  return (
    <div className="dashboard-shell-wide">
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
            <div>
              {data.snapshotStatus === "draft" ? (
                <button onClick={handleLock} disabled={locking} type="button">
                  {locking ? "Locking..." : "Lock Snapshot"}
                </button>
              ) : (
                <button className="ghost-btn" onClick={handleUnlock} disabled={locking} type="button">
                  {locking ? "Unlocking..." : "Unlock Snapshot"}
                </button>
              )}
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
