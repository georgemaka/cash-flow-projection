"use client";

import { useCallback, useEffect, useRef, useState, memo } from "react";
import type { GridData, GridGroup, GridRow, PendingEdit, ViewMode } from "./types";
import {
  formatCurrency,
  formatPeriodLabel,
  parseCurrencyInput,
  getCombinedValue,
  isPastPeriod
} from "./types";

interface CashFlowGridProps {
  data: GridData;
  /** Whether the user can edit values (false for viewers or locked snapshots). */
  editable: boolean;
  /** Callback when a cell value is committed. */
  onCellChange?: (edit: PendingEdit) => void;
  /** Which value layer to show. */
  viewMode: ViewMode;
}

export function CashFlowGrid({ data, editable, onCellChange, viewMode }: CashFlowGridProps) {
  const isLocked = data.snapshotStatus === "locked";
  const canEdit = editable && !isLocked;

  return (
    <div className="cf-grid-wrapper" role="region" aria-label="Cash flow data grid">
      <div className="cf-grid-scroll">
        <table className="cf-grid" role="grid">
          <thead>
            <tr>
              <th className="cf-grid-label-col cf-grid-sticky-col">Line Item</th>
              {data.periods.map((p) => {
                const past = isPastPeriod(p);
                return (
                  <th
                    key={p}
                    className={`cf-grid-period-col${viewMode === "combined" && past ? " cf-grid-period-actual" : ""}`}
                  >
                    <span>{formatPeriodLabel(p)}</span>
                    {viewMode === "combined" && (
                      <span
                        className={`cf-grid-period-tag ${past ? "cf-grid-period-tag-actual" : "cf-grid-period-tag-proj"}`}
                      >
                        {past ? "Act" : "Proj"}
                      </span>
                    )}
                  </th>
                );
              })}
              <th className="cf-grid-total-col">Total</th>
            </tr>
            {viewMode === "variance" && (
              <tr className="cf-grid-subheader">
                <th className="cf-grid-sticky-col"></th>
                {data.periods.map((p) => (
                  <th key={`sub-${p}`}>
                    <div className="cf-grid-sublabels">
                      <span>Proj</span>
                      <span>Act</span>
                      <span>Var</span>
                    </div>
                  </th>
                ))}
                <th>
                  <div className="cf-grid-sublabels">
                    <span>Proj</span>
                    <span>Act</span>
                    <span>Var</span>
                  </div>
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {data.groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                periods={data.periods}
                canEdit={canEdit}
                viewMode={viewMode}
                onCellChange={onCellChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group Section
// ---------------------------------------------------------------------------
interface GroupSectionProps {
  group: GridGroup;
  periods: string[];
  canEdit: boolean;
  viewMode: string;
  onCellChange?: (edit: PendingEdit) => void;
}

const GroupSection = memo(function GroupSection({
  group,
  periods,
  canEdit,
  viewMode,
  onCellChange
}: GroupSectionProps) {
  return (
    <>
      <tr className="cf-grid-group-header" role="row">
        <td className="cf-grid-sticky-col" colSpan={1} role="rowheader">
          <span className="cf-grid-group-name">{group.name}</span>
          <span className="cf-grid-group-type">{group.groupType.replace("_", " ")}</span>
        </td>
        {periods.map((p) => (
          <td key={p} className="cf-grid-group-cell"></td>
        ))}
        <td className="cf-grid-group-cell"></td>
      </tr>
      {group.rows.map((row) => (
        <LineItemRow
          key={row.lineItemId}
          row={row}
          periods={periods}
          canEdit={canEdit}
          viewMode={viewMode}
          onCellChange={onCellChange}
        />
      ))}
      <SubtotalRow group={group} periods={periods} viewMode={viewMode} />
    </>
  );
});

// ---------------------------------------------------------------------------
// Line Item Row
// ---------------------------------------------------------------------------
interface LineItemRowProps {
  row: GridRow;
  periods: string[];
  canEdit: boolean;
  viewMode: string;
  onCellChange?: (edit: PendingEdit) => void;
}

function LineItemRow({ row, periods, canEdit, viewMode, onCellChange }: LineItemRowProps) {
  const calcTotal = (field: "projected" | "actual"): number => {
    let sum = 0;
    for (const p of periods) {
      const val = row.values[p]?.[field];
      if (val !== null && val !== undefined) {
        sum += parseFloat(val);
      }
    }
    return sum;
  };

  const projTotal = calcTotal("projected");
  const actTotal = calcTotal("actual");

  const calcCombinedTotal = (): number => {
    let sum = 0;
    for (const p of periods) {
      const cell = row.values[p];
      if (!cell) continue;
      const { value } = getCombinedValue(cell, p);
      if (value !== null) sum += parseFloat(value);
    }
    return sum;
  };

  const displayTotal = (): number => {
    if (viewMode === "combined") return calcCombinedTotal();
    return viewMode === "projected" ? projTotal : actTotal;
  };

  return (
    <tr className="cf-grid-row">
      <td className="cf-grid-sticky-col cf-grid-label">
        <span className="cf-grid-item-label">{row.label}</span>
        <span className="cf-grid-item-method">{row.projectionMethod.replace(/_/g, " ")}</span>
      </td>
      {periods.map((p) => {
        const cell = row.values[p] ?? { projected: null, actual: null, note: null, dirty: false };
        return (
          <GridCell
            key={p}
            lineItemId={row.lineItemId}
            period={p}
            projected={cell.projected}
            actual={cell.actual}
            note={cell.note}
            dirty={cell.dirty}
            canEdit={canEdit}
            viewMode={viewMode}
            onCellChange={onCellChange}
          />
        );
      })}
      <td className="cf-grid-total-cell">
        {viewMode === "variance" ? (
          <div className="cf-grid-variance-cell">
            <span>{formatCurrency(projTotal.toFixed(2))}</span>
            <span>{formatCurrency(actTotal.toFixed(2))}</span>
            <span className={getVarianceClass(projTotal, actTotal)}>
              {formatCurrency((actTotal - projTotal).toFixed(2))}
            </span>
          </div>
        ) : (
          <span className="cf-grid-total-value">{formatCurrency(displayTotal().toFixed(2))}</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Editable Grid Cell
// ---------------------------------------------------------------------------
interface GridCellProps {
  lineItemId: string;
  period: string;
  projected: string | null;
  actual: string | null;
  note: string | null;
  dirty: boolean;
  canEdit: boolean;
  viewMode: string;
  onCellChange?: (edit: PendingEdit) => void;
}

function GridCell({
  lineItemId,
  period,
  projected,
  actual,
  note,
  dirty,
  canEdit,
  viewMode,
  onCellChange
}: GridCellProps) {
  const [editing, setEditing] = useState<"projected" | "actual" | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Close note popover if snapshot becomes locked or note changes externally
  useEffect(() => {
    if (!canEdit) setNoteOpen(false);
  }, [canEdit]);

  const startEdit = useCallback(
    (field: "projected" | "actual") => {
      if (!canEdit) return;
      setEditing(field);
      const current = field === "projected" ? projected : actual;
      setEditValue(current ?? "");
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [canEdit, projected, actual]
  );

  const commitEdit = useCallback(() => {
    if (!editing || !onCellChange) return;
    const parsed = parseCurrencyInput(editValue);
    if (editValue.trim() !== "" && parsed === null) {
      // Invalid input — revert without committing
      setEditing(null);
      return;
    }
    const current = editing === "projected" ? projected : actual;
    // Only emit if value actually changed
    if (parsed !== current) {
      onCellChange({ lineItemId, period, field: editing, value: parsed });
    }
    setEditing(null);
  }, [editing, editValue, lineItemId, period, projected, actual, onCellChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commitEdit();
      }
      if (e.key === "Escape") {
        setEditing(null);
      }
    },
    [commitEdit]
  );

  const openNote = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setNoteValue(note ?? "");
      setNoteOpen(true);
      setTimeout(() => noteInputRef.current?.focus(), 0);
    },
    [note]
  );

  const commitNote = useCallback(() => {
    if (!onCellChange) return;
    const trimmed = noteValue.trim() || null;
    if (trimmed !== note) {
      onCellChange({ lineItemId, period, field: "note", value: trimmed });
    }
    setNoteOpen(false);
  }, [noteValue, note, lineItemId, period, onCellChange]);

  const cancelNote = useCallback(() => {
    setNoteOpen(false);
    setNoteValue("");
  }, []);

  const noteButton =
    note || canEdit ? (
      <div className="cf-cell-note-area">
        <button
          className={`cf-note-btn${note ? " cf-note-btn-filled" : ""}`}
          onClick={openNote}
          type="button"
          aria-label={note ? "Edit note" : "Add note"}
          title={note ?? "Add note"}
        >
          {note ? "\u25CF" : "\u25CB"}
        </button>
        {noteOpen && (
          <div className="cf-note-popover" role="dialog" onClick={(e) => e.stopPropagation()}>
            <textarea
              ref={noteInputRef}
              className="cf-note-textarea"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Add a note\u2026"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancelNote();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitNote();
              }}
            />
            <div className="cf-note-actions">
              <button onClick={commitNote} type="button" className="cf-note-save">
                Save
              </button>
              <button onClick={cancelNote} type="button" className="ghost-btn cf-note-cancel">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    ) : null;

  const cellClass = `cf-grid-cell${dirty ? " cf-grid-cell-dirty" : ""}`;

  if (viewMode === "variance") {
    const proj = projected ? parseFloat(projected) : 0;
    const act = actual ? parseFloat(actual) : 0;
    const variance = act - proj;
    return (
      <td className={cellClass}>
        {noteButton}
        <div className="cf-grid-variance-cell">
          <span
            className="cf-grid-val cf-grid-val-proj"
            onDoubleClick={() => startEdit("projected")}
          >
            {editing === "projected" ? (
              <input
                ref={inputRef}
                className="cf-grid-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
              />
            ) : (
              formatCurrency(projected)
            )}
          </span>
          <span className="cf-grid-val cf-grid-val-act" onDoubleClick={() => startEdit("actual")}>
            {editing === "actual" ? (
              <input
                ref={inputRef}
                className="cf-grid-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
              />
            ) : (
              formatCurrency(actual)
            )}
          </span>
          <span className={`cf-grid-val cf-grid-val-var ${getVarianceClass(proj, act)}`}>
            {formatCurrency(variance.toFixed(2))}
          </span>
        </div>
      </td>
    );
  }

  // Combined view: show actual for past months, projected for future
  if (viewMode === "combined") {
    const { value: combinedValue, source } = getCombinedValue(
      { projected, actual, note, dirty },
      period
    );
    const editField = source;
    const isActual = source === "actual";

    return (
      <td
        className={`${cellClass}${isActual ? " cf-grid-cell-actual" : ""}`}
        onDoubleClick={() => startEdit(editField)}
        role="gridcell"
        aria-label={`${source} ${formatPeriodLabel(period)}`}
      >
        {noteButton}
        {editing === editField ? (
          <input
            ref={inputRef}
            className="cf-grid-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            aria-label={`Edit ${source} for ${formatPeriodLabel(period)}`}
          />
        ) : (
          <span className={`cf-grid-val ${canEdit ? "cf-grid-val-editable" : ""}`}>
            {formatCurrency(combinedValue)}
          </span>
        )}
      </td>
    );
  }

  const field = viewMode === "projected" ? "projected" : "actual";
  const displayValue = field === "projected" ? projected : actual;

  return (
    <td
      className={cellClass}
      onDoubleClick={() => startEdit(field)}
      role="gridcell"
      aria-label={`${field} ${formatPeriodLabel(period)}`}
    >
      {noteButton}
      {editing === field ? (
        <input
          ref={inputRef}
          className="cf-grid-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          aria-label={`Edit ${field} for ${formatPeriodLabel(period)}`}
        />
      ) : (
        <span className={`cf-grid-val ${canEdit ? "cf-grid-val-editable" : ""}`}>
          {formatCurrency(displayValue)}
        </span>
      )}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Subtotal Row
// ---------------------------------------------------------------------------
interface SubtotalRowProps {
  group: GridGroup;
  periods: string[];
  viewMode: string;
}

function SubtotalRow({ group, periods, viewMode }: SubtotalRowProps) {
  const calcGroupTotal = (period: string, field: "projected" | "actual"): number => {
    let sum = 0;
    for (const row of group.rows) {
      const val = row.values[period]?.[field];
      if (val !== null && val !== undefined) {
        sum += parseFloat(val);
      }
    }
    return sum;
  };

  const calcGroupCombined = (period: string): number => {
    let sum = 0;
    for (const row of group.rows) {
      const cell = row.values[period];
      if (!cell) continue;
      const { value } = getCombinedValue(cell, period);
      if (value !== null) sum += parseFloat(value);
    }
    return sum;
  };

  const grandTotal = (field: "projected" | "actual"): number => {
    let sum = 0;
    for (const p of periods) {
      sum += calcGroupTotal(p, field);
    }
    return sum;
  };

  const grandCombinedTotal = (): number => {
    let sum = 0;
    for (const p of periods) {
      sum += calcGroupCombined(p);
    }
    return sum;
  };

  const periodSubtotal = (p: string): number => {
    if (viewMode === "combined") return calcGroupCombined(p);
    return viewMode === "projected" ? calcGroupTotal(p, "projected") : calcGroupTotal(p, "actual");
  };

  const totalSubtotal = (): number => {
    if (viewMode === "combined") return grandCombinedTotal();
    return viewMode === "projected" ? grandTotal("projected") : grandTotal("actual");
  };

  return (
    <tr className="cf-grid-subtotal">
      <td className="cf-grid-sticky-col">
        <span className="cf-grid-subtotal-label">Subtotal: {group.name}</span>
      </td>
      {periods.map((p) => {
        const projSub = calcGroupTotal(p, "projected");
        const actSub = calcGroupTotal(p, "actual");
        return (
          <td key={p} className="cf-grid-subtotal-cell">
            {viewMode === "variance" ? (
              <div className="cf-grid-variance-cell">
                <span>{formatCurrency(projSub.toFixed(2))}</span>
                <span>{formatCurrency(actSub.toFixed(2))}</span>
                <span className={getVarianceClass(projSub, actSub)}>
                  {formatCurrency((actSub - projSub).toFixed(2))}
                </span>
              </div>
            ) : (
              formatCurrency(periodSubtotal(p).toFixed(2))
            )}
          </td>
        );
      })}
      <td className="cf-grid-subtotal-cell">
        {viewMode === "variance" ? (
          <div className="cf-grid-variance-cell">
            <span>{formatCurrency(grandTotal("projected").toFixed(2))}</span>
            <span>{formatCurrency(grandTotal("actual").toFixed(2))}</span>
            <span className={getVarianceClass(grandTotal("projected"), grandTotal("actual"))}>
              {formatCurrency((grandTotal("actual") - grandTotal("projected")).toFixed(2))}
            </span>
          </div>
        ) : (
          formatCurrency(totalSubtotal().toFixed(2))
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getVarianceClass(projected: number, actual: number): string {
  const diff = actual - projected;
  if (diff > 0) return "cf-grid-var-positive";
  if (diff < 0) return "cf-grid-var-negative";
  return "";
}
