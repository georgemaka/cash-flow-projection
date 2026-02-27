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

function MobileGroup({
  group,
  periods,
  expandedItem,
  onToggle,
  canEdit,
  onCellChange
}: MobileGroupProps) {
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
          onToggle={() => onToggle(expandedItem === row.lineItemId ? null : row.lineItemId)}
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

function MobileItemCard({
  row,
  periods,
  expanded,
  onToggle,
  canEdit,
  onCellChange
}: MobileItemCardProps) {
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
            const cell = row.values[p] ?? {
              projected: null,
              actual: null,
              note: null,
              dirty: false
            };
            return (
              <MobileMonthRow
                key={p}
                period={p}
                lineItemId={row.lineItemId}
                projected={cell.projected}
                actual={cell.actual}
                note={cell.note}
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
  note: string | null;
  canEdit: boolean;
  onCellChange?: (edit: PendingEdit) => void;
}

function MobileMonthRow({
  period,
  lineItemId,
  projected,
  actual,
  note,
  canEdit,
  onCellChange
}: MobileMonthRowProps) {
  const [editingField, setEditingField] = useState<"projected" | "actual" | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

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

  const startNoteEdit = useCallback(() => {
    if (!canEdit) return;
    setNoteValue(note ?? "");
    setEditingNote(true);
    setTimeout(() => noteInputRef.current?.focus(), 0);
  }, [canEdit, note]);

  const commitNote = useCallback(() => {
    if (!onCellChange) return;
    const trimmed = noteValue.trim() || null;
    if (trimmed !== note) {
      onCellChange({ lineItemId, period, field: "note", value: trimmed });
    }
    setEditingNote(false);
  }, [noteValue, note, lineItemId, period, onCellChange]);

  const cancelNote = useCallback(() => {
    setEditingNote(false);
    setNoteValue("");
  }, []);

  return (
    <div className="cf-mobile-month">
      <div className="cf-mobile-month-main">
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
      {(note || canEdit) && (
        <div className="cf-mobile-note-row">
          {editingNote ? (
            <>
              <textarea
                ref={noteInputRef}
                className="cf-mobile-note-input"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Add a note\u2026"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelNote();
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitNote();
                }}
              />
              <div className="cf-mobile-note-actions">
                <button onClick={commitNote} type="button" className="cf-mobile-note-save">
                  Save
                </button>
                <button
                  onClick={cancelNote}
                  type="button"
                  className="ghost-btn cf-mobile-note-cancel"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div
              className={`cf-mobile-note-text${canEdit ? " cf-mobile-note-editable" : ""}`}
              onClick={canEdit ? startNoteEdit : undefined}
            >
              {note ?? (
                <span className="cf-mobile-note-placeholder">Add note\u2026</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
