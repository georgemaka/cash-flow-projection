"use client";

import { useCallback, useRef, useState } from "react";
import type { GridData, GridGroup, GridRow, PendingEdit } from "./types";
import { formatCurrency, formatPeriodLabel, parseCurrencyInput } from "./types";

interface CashFlowGridProps {
  data: GridData;
  /** Whether the user can edit values (false for viewers or locked snapshots). */
  editable: boolean;
  /** Callback when a cell value is committed. */
  onCellChange?: (edit: PendingEdit) => void;
  /** Which value layer to show: projected, actual, or both. */
  viewMode: "projected" | "actual" | "variance";
}

export function CashFlowGrid({ data, editable, onCellChange, viewMode }: CashFlowGridProps) {
  const isLocked = data.snapshotStatus === "locked";
  const canEdit = editable && !isLocked;

  return (
    <div className="cf-grid-wrapper">
      <div className="cf-grid-scroll">
        <table className="cf-grid">
          <thead>
            <tr>
              <th className="cf-grid-label-col cf-grid-sticky-col">Line Item</th>
              {data.periods.map((p) => (
                <th key={p} className="cf-grid-period-col">
                  {formatPeriodLabel(p)}
                </th>
              ))}
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

function GroupSection({ group, periods, canEdit, viewMode, onCellChange }: GroupSectionProps) {
  return (
    <>
      <tr className="cf-grid-group-header">
        <td className="cf-grid-sticky-col" colSpan={1}>
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
}

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
          <span className="cf-grid-total-value">
            {formatCurrency(
              (viewMode === "projected" ? projTotal : actTotal).toFixed(2)
            )}
          </span>
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
  dirty,
  canEdit,
  viewMode,
  onCellChange
}: GridCellProps) {
  const [editing, setEditing] = useState<"projected" | "actual" | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  const cellClass = `cf-grid-cell${dirty ? " cf-grid-cell-dirty" : ""}`;

  if (viewMode === "variance") {
    const proj = projected ? parseFloat(projected) : 0;
    const act = actual ? parseFloat(actual) : 0;
    const variance = act - proj;
    return (
      <td className={cellClass}>
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
          <span
            className="cf-grid-val cf-grid-val-act"
            onDoubleClick={() => startEdit("actual")}
          >
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

  const field = viewMode === "projected" ? "projected" : "actual";
  const displayValue = field === "projected" ? projected : actual;

  return (
    <td className={cellClass} onDoubleClick={() => startEdit(field)}>
      {editing === field ? (
        <input
          ref={inputRef}
          className="cf-grid-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
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

  const grandTotal = (field: "projected" | "actual"): number => {
    let sum = 0;
    for (const p of periods) {
      sum += calcGroupTotal(p, field);
    }
    return sum;
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
              formatCurrency(
                (viewMode === "projected" ? projSub : actSub).toFixed(2)
              )
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
          formatCurrency(
            (viewMode === "projected"
              ? grandTotal("projected")
              : grandTotal("actual")
            ).toFixed(2)
          )
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
