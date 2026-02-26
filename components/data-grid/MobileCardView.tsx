"use client";

import { useCallback, useRef, useState } from "react";
import type { GridData, GridGroup, GridRow, PendingEdit } from "./types";
import { formatCurrency, formatPeriodLabel, parseCurrencyInput } from "./types";

interface MobileCardViewProps {
  data: GridData;
  editable: boolean;
  onCellChange?: (edit: PendingEdit) => void;
}

export function MobileCardView({ data, editable, onCellChange }: MobileCardViewProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const canEdit = editable && data.snapshotStatus !== "locked";

  return (
    <div className="cf-mobile">
      {data.groups.map((group) => (
        <MobileGroup
          key={group.id}
          group={group}
          periods={data.periods}
          expandedItem={expandedItem}
          onToggle={setExpandedItem}
          canEdit={canEdit}
          onCellChange={onCellChange}
        />
      ))}
    </div>
  );
}

interface MobileGroupProps {
  group: GridGroup;
  periods: string[];
  expandedItem: string | null;
  onToggle: (id: string | null) => void;
  canEdit: boolean;
  onCellChange?: (edit: PendingEdit) => void;
}

function MobileGroup({ group, periods, expandedItem, onToggle, canEdit, onCellChange }: MobileGroupProps) {
  return (
    <div className="cf-mobile-group">
      <div className="cf-mobile-group-header">
        <span className="cf-mobile-group-name">{group.name}</span>
        <span className="cf-mobile-group-type">{group.groupType.replace("_", " ")}</span>
      </div>
      {group.rows.map((row) => (
        <MobileItemCard
          key={row.lineItemId}
          row={row}
          periods={periods}
          expanded={expandedItem === row.lineItemId}
          onToggle={() =>
            onToggle(expandedItem === row.lineItemId ? null : row.lineItemId)
          }
          canEdit={canEdit}
          onCellChange={onCellChange}
        />
      ))}
    </div>
  );
}

interface MobileItemCardProps {
  row: GridRow;
  periods: string[];
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onCellChange?: (edit: PendingEdit) => void;
}

function MobileItemCard({ row, periods, expanded, onToggle, canEdit, onCellChange }: MobileItemCardProps) {
  const projTotal = periods.reduce((sum, p) => {
    const val = row.values[p]?.projected;
    return sum + (val ? parseFloat(val) : 0);
  }, 0);

  return (
    <div className={`cf-mobile-card${expanded ? " cf-mobile-card-expanded" : ""}`}>
      <button className="cf-mobile-card-header" onClick={onToggle} type="button">
        <span className="cf-mobile-card-label">{row.label}</span>
        <span className="cf-mobile-card-total">{formatCurrency(projTotal.toFixed(2))}</span>
        <span className="cf-mobile-card-chevron">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>
      {expanded && (
        <div className="cf-mobile-card-body">
          {periods.map((p) => {
            const cell = row.values[p] ?? { projected: null, actual: null, note: null, dirty: false };
            return (
              <MobileMonthRow
                key={p}
                period={p}
                lineItemId={row.lineItemId}
                projected={cell.projected}
                actual={cell.actual}
                canEdit={canEdit}
                onCellChange={onCellChange}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MobileMonthRowProps {
  period: string;
  lineItemId: string;
  projected: string | null;
  actual: string | null;
  canEdit: boolean;
  onCellChange?: (edit: PendingEdit) => void;
}

function MobileMonthRow({ period, lineItemId, projected, actual, canEdit, onCellChange }: MobileMonthRowProps) {
  const [editingField, setEditingField] = useState<"projected" | "actual" | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(
    (field: "projected" | "actual") => {
      if (!canEdit) return;
      setEditingField(field);
      const current = field === "projected" ? projected : actual;
      setEditValue(current ?? "");
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [canEdit, projected, actual]
  );

  const commitEdit = useCallback(() => {
    if (!editingField || !onCellChange) return;
    const parsed = parseCurrencyInput(editValue);
    const current = editingField === "projected" ? projected : actual;
    if (parsed !== current) {
      onCellChange({ lineItemId, period, field: editingField, value: parsed });
    }
    setEditingField(null);
  }, [editingField, editValue, lineItemId, period, projected, actual, onCellChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      }
    },
    [commitEdit]
  );

  return (
    <div className="cf-mobile-month">
      <span className="cf-mobile-month-label">{formatPeriodLabel(period)}</span>
      <div className="cf-mobile-month-values">
        <div className="cf-mobile-field" onClick={() => startEdit("projected")}>
          <span className="cf-mobile-field-label">Proj</span>
          {editingField === "projected" ? (
            <input
              ref={inputRef}
              className="cf-mobile-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              inputMode="decimal"
            />
          ) : (
            <span className={`cf-mobile-field-value${canEdit ? " cf-mobile-editable" : ""}`}>
              {formatCurrency(projected)}
            </span>
          )}
        </div>
        <div className="cf-mobile-field" onClick={() => startEdit("actual")}>
          <span className="cf-mobile-field-label">Act</span>
          {editingField === "actual" ? (
            <input
              ref={inputRef}
              className="cf-mobile-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              inputMode="decimal"
            />
          ) : (
            <span className={`cf-mobile-field-value${canEdit ? " cf-mobile-editable" : ""}`}>
              {formatCurrency(actual)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
