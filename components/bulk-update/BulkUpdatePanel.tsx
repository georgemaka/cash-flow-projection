"use client";

import { useCallback, useState } from "react";
import type { GridGroup } from "@/components/data-grid/types";
import { formatCurrency } from "@/components/data-grid/types";
import { formatPeriodLabel } from "@/components/data-grid/types";

export interface BulkChange {
  lineItemId: string;
  lineItemLabel: string;
  period: string;
  oldValue: string | null;
  newValue: string | null;
}

interface BulkApplyResult {
  changes: BulkChange[];
  count: number;
}

interface BulkUpdatePanelProps {
  snapshotId: string;
  groups: GridGroup[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkUpdatePanel({ snapshotId, groups, onClose, onSuccess }: BulkUpdatePanelProps) {
  const [groupId, setGroupId] = useState<string>("all");
  const [field, setField] = useState<"projected" | "actual">("projected");
  const [operation, setOperation] = useState<"multiply" | "add">("multiply");
  const [operand, setOperand] = useState("");
  const [reason, setReason] = useState("");

  const [preview, setPreview] = useState<BulkChange[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastApplied, setLastApplied] = useState<BulkApplyResult | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  const operandNum = parseFloat(operand);
  const operandValid = operand.trim().length > 0 && isFinite(operandNum);

  const buildPayload = (isPreview: boolean) => ({
    snapshotId,
    groupId: groupId === "all" ? undefined : groupId,
    field,
    operation,
    operand: operandNum,
    preview: isPreview,
    ...(isPreview ? {} : { reason: reason.trim() })
  });

  const handlePreview = useCallback(async () => {
    if (!operandValid) return;
    setPreviewing(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/values/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(true))
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Preview failed");
      setPreview((body.data as BulkChange[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, groupId, field, operation, operand, operandValid]);

  const handleApply = useCallback(async () => {
    if (!operandValid || !reason.trim()) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/values/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(false))
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Apply failed");
      const result = body.data as BulkApplyResult;
      setLastApplied(result);
      setUndone(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, groupId, field, operation, operand, operandValid, reason, onSuccess]);

  const handleUndo = useCallback(async () => {
    if (!lastApplied || undone) return;
    setUndoing(true);
    setError(null);
    try {
      // Build restore list from the before-state captured in lastApplied.changes
      const restores = lastApplied.changes.map((c) => ({
        lineItemId: c.lineItemId,
        period: c.period,
        projectedAmount: field === "projected" ? c.oldValue : undefined,
        actualAmount: field === "actual" ? c.oldValue : undefined
      }));
      const res = await fetch("/api/values/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          restores,
          reason: `Undo: ${reason.trim()}`
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Undo failed");
      setUndone(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setUndoing(false);
    }
  }, [lastApplied, undone, field, snapshotId, reason, onSuccess]);

  const changesWithDiff = (preview ?? []).filter(
    (c) => c.newValue !== null && c.newValue !== c.oldValue
  );

  const operandLabel =
    operation === "multiply"
      ? operandNum >= 0
        ? `+${operandNum}%`
        : `${operandNum}%`
      : operandNum >= 0
        ? `+$${Math.abs(operandNum).toLocaleString()}`
        : `($${Math.abs(operandNum).toLocaleString()})`;

  return (
    <div className="bu-overlay">
      <div className="bu-panel" role="dialog" aria-modal="true" aria-label="Bulk update">
        <div className="bu-panel-header">
          <h3 className="bu-panel-title">Bulk Update</h3>
          <button className="ghost-btn bu-close" onClick={onClose} type="button">
            &times;
          </button>
        </div>

        <div className="bu-form">
          <div className="bu-field-row">
            <label className="bu-label">Group</label>
            <select
              className="bu-select"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bu-field-row">
            <label className="bu-label">Field</label>
            <div className="bu-toggle">
              <button
                className={`ghost-btn${field === "projected" ? " bu-toggle-active" : ""}`}
                onClick={() => setField("projected")}
                type="button"
              >
                Projected
              </button>
              <button
                className={`ghost-btn${field === "actual" ? " bu-toggle-active" : ""}`}
                onClick={() => setField("actual")}
                type="button"
              >
                Actual
              </button>
            </div>
          </div>

          <div className="bu-field-row">
            <label className="bu-label">Operation</label>
            <div className="bu-toggle">
              <button
                className={`ghost-btn${operation === "multiply" ? " bu-toggle-active" : ""}`}
                onClick={() => setOperation("multiply")}
                type="button"
              >
                % Change
              </button>
              <button
                className={`ghost-btn${operation === "add" ? " bu-toggle-active" : ""}`}
                onClick={() => setOperation("add")}
                type="button"
              >
                Flat Adjust
              </button>
            </div>
          </div>

          <div className="bu-field-row">
            <label className="bu-label">
              {operation === "multiply" ? "Percent (%)" : "Amount ($)"}
            </label>
            <input
              className="bu-input"
              type="number"
              step={operation === "multiply" ? "0.1" : "1000"}
              value={operand}
              onChange={(e) => setOperand(e.target.value)}
              placeholder={operation === "multiply" ? "e.g. 5 for +5%" : "e.g. 10000"}
            />
            {operandValid && <span className="bu-operand-preview">{operandLabel}</span>}
          </div>

          <div className="bu-actions-row">
            <button onClick={handlePreview} disabled={!operandValid || previewing} type="button">
              {previewing ? "Loading\u2026" : "Preview"}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner bu-error">
            <p>{error}</p>
          </div>
        )}

        {preview !== null && (
          <div className="bu-preview-section">
            <p className="bu-preview-summary">
              {changesWithDiff.length === 0
                ? "No cells would change."
                : `${changesWithDiff.length} cell${changesWithDiff.length !== 1 ? "s" : ""} would change.`}
            </p>

            {changesWithDiff.length > 0 && (
              <>
                <div className="bu-preview-table-wrap">
                  <table className="bu-preview-table">
                    <thead>
                      <tr>
                        <th>Line Item</th>
                        <th>Period</th>
                        <th>Before</th>
                        <th>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changesWithDiff.slice(0, 100).map((c) => (
                        <tr key={`${c.lineItemId}:${c.period}`}>
                          <td className="bu-preview-label">{c.lineItemLabel}</td>
                          <td className="bu-preview-period">{formatPeriodLabel(c.period)}</td>
                          <td className="bu-preview-val bu-preview-old">
                            {formatCurrency(c.oldValue)}
                          </td>
                          <td className="bu-preview-val bu-preview-new">
                            {formatCurrency(c.newValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {changesWithDiff.length > 100 && (
                    <p className="bu-preview-trunc">
                      Showing first 100 of {changesWithDiff.length} changes.
                    </p>
                  )}
                </div>

                <div className="bu-confirm-section">
                  <textarea
                    className="bu-reason-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for this bulk change (required)\u2026"
                    rows={2}
                  />
                  <div className="bu-confirm-actions">
                    <button
                      onClick={handleApply}
                      disabled={!reason.trim() || applying || lastApplied !== null}
                      type="button"
                    >
                      {applying
                        ? "Applying\u2026"
                        : lastApplied
                          ? "\u2713 Applied"
                          : `Apply to ${changesWithDiff.length} cell${changesWithDiff.length !== 1 ? "s" : ""}`}
                    </button>
                    {lastApplied && !undone && (
                      <button
                        className="ghost-btn"
                        onClick={handleUndo}
                        disabled={undoing}
                        type="button"
                      >
                        {undoing ? "Undoing\u2026" : "Undo"}
                      </button>
                    )}
                    {undone && <span className="bu-undone-badge">\u2713 Undone</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
