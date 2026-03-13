"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CashFlowGrid } from "./CashFlowGrid";
import { ListTableView } from "./ListTableView";
import { MobileCardView } from "./MobileCardView";
import { NotesSidebar } from "./NotesSidebar";
import type { GridData, PendingEdit, ViewMode } from "./types";
import { ReasonRequiredError } from "@/lib/hooks/use-grid-data";
import { BulkUpdatePanel } from "@/components/bulk-update/BulkUpdatePanel";
import { useToast } from "@/components/ui/Toast";
import "@/components/bulk-update/bulk-update.css";

interface DataGridViewProps {
  data: GridData;
  editable: boolean;
  onSave?: (edits: PendingEdit[], reason?: string) => Promise<void>;
  /** Called after a bulk update so the parent can reload grid data. */
  onReload?: () => void;
}

/**
 * Responsive data grid view.
 * Shows a spreadsheet table on desktop and card-based layout on mobile.
 * Manages pending edits and save state.
 */
export function DataGridView({ data, editable, onSave, onReload }: DataGridViewProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [saving, setSaving] = useState(false);
  const [gridData, setGridData] = useState<GridData>(data);
  const [isMobile, setIsMobile] = useState(false);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [reasonPrompt, setReasonPrompt] = useState<{
    threshold: number;
    delta: number;
    field: string;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Reset grid data when prop changes
  useEffect(() => {
    setGridData(data);
    setPendingEdits([]);
  }, [data]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (pendingEdits.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingEdits.length]);

  const handleCellChange = useCallback((edit: PendingEdit) => {
    // Optimistically update the grid data
    setGridData((prev) => {
      const updated = {
        ...prev,
        groups: prev.groups.map((g) => ({
          ...g,
          rows: g.rows.map((r) => {
            if (r.lineItemId !== edit.lineItemId) return r;
            const cell = r.values[edit.period] ?? {
              projected: null,
              actual: null,
              note: null,
              dirty: false
            };
            return {
              ...r,
              values: {
                ...r.values,
                [edit.period]: {
                  ...cell,
                  [edit.field]: edit.value,
                  dirty: true
                }
              }
            };
          })
        }))
      };
      return updated;
    });

    // Track pending edit (dedup by lineItemId + period + field)
    setPendingEdits((prev) => {
      const key = `${edit.lineItemId}:${edit.period}:${edit.field}`;
      const filtered = prev.filter((e) => `${e.lineItemId}:${e.period}:${e.field}` !== key);
      return [...filtered, edit];
    });
  }, []);

  const clearDirtyFlags = useCallback(() => {
    setGridData((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => ({
        ...g,
        rows: g.rows.map((r) => ({
          ...r,
          values: Object.fromEntries(
            Object.entries(r.values).map(([k, v]) => [k, { ...v, dirty: false }])
          )
        }))
      }))
    }));
    setPendingEdits([]);
  }, []);

  const handleSave = useCallback(
    async (reason?: string) => {
      if (!onSave || pendingEdits.length === 0) return;
      setSaving(true);
      try {
        await onSave(pendingEdits, reason);
        clearDirtyFlags();
        toast("Changes saved", "success");
      } catch (err) {
        if (err instanceof ReasonRequiredError) {
          setReasonPrompt({ threshold: err.threshold, delta: err.delta, field: err.field });
          setTimeout(() => reasonInputRef.current?.focus(), 50);
        } else {
          toast(err instanceof Error ? err.message : "Save failed", "error");
        }
      } finally {
        setSaving(false);
      }
    },
    [onSave, pendingEdits, clearDirtyFlags, toast]
  );

  const handleReasonConfirm = useCallback(async () => {
    if (!reasonText.trim()) return;
    const reason = reasonText.trim();
    setReasonPrompt(null);
    setReasonText("");
    await handleSave(reason);
  }, [handleSave, reasonText]);

  const handleReasonCancel = useCallback(() => {
    setReasonPrompt(null);
    setReasonText("");
  }, []);

  const handleMoveToGroup = useCallback(
    async (lineItemId: string, newGroupId: string) => {
      try {
        const res = await fetch(`/api/line-items/${lineItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: newGroupId }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Failed to move item");
        }
        toast("Item moved to new category", "success");
        onReload?.();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Move failed", "error");
      }
    },
    [toast, onReload]
  );

  const isLocked = gridData.snapshotStatus === "locked";

  const noteCount = useMemo(() => {
    let count = 0;
    for (const g of gridData.groups) {
      for (const r of g.rows) {
        for (const cell of Object.values(r.values)) {
          if (cell.note) count++;
        }
      }
    }
    return count;
  }, [gridData]);

  return (
    <div className="cf-view">
      <div className="cf-view-toolbar">
        <div className="cf-view-modes">
          {(["combined", "projected", "actual", "variance"] as const).map((mode) => (
            <button
              key={mode}
              className={`ghost-btn${viewMode === mode ? " cf-view-mode-active" : ""}`}
              onClick={() => setViewMode(mode)}
              type="button"
              aria-pressed={viewMode === mode}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
          <span className="cf-view-separator" />
          <button
            className={`ghost-btn${viewMode === "list" ? " cf-view-mode-active" : ""}`}
            onClick={() => setViewMode("list")}
            type="button"
            aria-pressed={viewMode === "list"}
          >
            List
          </button>
        </div>
        <div className="cf-view-actions">
          {!isMobile && viewMode !== "list" && (
            <button
              className={`ghost-btn${notesPanelOpen ? " cf-view-mode-active" : ""}`}
              onClick={() => setNotesPanelOpen((prev) => !prev)}
              type="button"
              aria-pressed={notesPanelOpen}
            >
              Notes ({noteCount})
            </button>
          )}
          {isLocked && <span className="snapshot-chip locked">Locked</span>}
          {editable && !isLocked && (
            <>
              <button className="ghost-btn" onClick={() => setBulkPanelOpen(true)} type="button">
                Bulk Edit
              </button>
              <button
                onClick={() => handleSave()}
                disabled={saving || pendingEdits.length === 0}
                type="button"
              >
                {saving ? "Saving..." : `Save (${pendingEdits.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {reasonPrompt && (
        <div className="cf-reason-overlay">
          <div className="cf-reason-dialog" role="dialog" aria-modal="true">
            <h3 className="cf-reason-title">Reason required</h3>
            <p className="cf-reason-desc">
              This change to <strong>{reasonPrompt.field}</strong> is{" "}
              <strong>${Math.round(reasonPrompt.delta).toLocaleString()}</strong> (threshold: $
              {Math.round(reasonPrompt.threshold).toLocaleString()}). Please explain why.
            </p>
            <textarea
              ref={reasonInputRef}
              className="cf-reason-input"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Enter reason for this change…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReasonConfirm();
                if (e.key === "Escape") handleReasonCancel();
              }}
            />
            <div className="cf-reason-actions">
              <button onClick={handleReasonConfirm} disabled={!reasonText.trim()} type="button">
                Confirm &amp; Save
              </button>
              <button className="ghost-btn" onClick={handleReasonCancel} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`cf-view-body${notesPanelOpen && !isMobile && viewMode !== "list" ? " cf-view-body-with-sidebar" : ""}`}>
        <div className="cf-view-main">
          {viewMode === "list" ? (
            <ListTableView
              data={gridData}
              editable={editable && !isLocked}
              onCellChange={handleCellChange}
              onMoveToGroup={handleMoveToGroup}
            />
          ) : isMobile ? (
            <MobileCardView data={gridData} editable={editable} onCellChange={handleCellChange} />
          ) : (
            <CashFlowGrid
              data={gridData}
              editable={editable}
              onCellChange={handleCellChange}
              viewMode={viewMode}
            />
          )}
        </div>
        {notesPanelOpen && !isMobile && viewMode !== "list" && (
          <NotesSidebar
            data={gridData}
            editable={editable && !isLocked}
            onCellChange={handleCellChange}
            onClose={() => setNotesPanelOpen(false)}
          />
        )}
      </div>

      {bulkPanelOpen && (
        <BulkUpdatePanel
          snapshotId={gridData.snapshotId}
          groups={gridData.groups}
          onClose={() => setBulkPanelOpen(false)}
          onSuccess={() => {
            setBulkPanelOpen(false);
            onReload?.();
          }}
        />
      )}
    </div>
  );
}
