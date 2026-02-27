"use client";

import { useMemo, useRef, useState } from "react";
import type { GridData, PendingEdit } from "./types";
import { formatPeriodLabel } from "./types";

interface NoteEntry {
  lineItemId: string;
  lineItemLabel: string;
  groupName: string;
  period: string;
  periodLabel: string;
  note: string;
}

interface NotesSidebarProps {
  data: GridData;
  editable: boolean;
  onCellChange: (edit: PendingEdit) => void;
  onClose: () => void;
}

type GroupBy = "lineItem" | "month";

export function NotesSidebar({ data, editable, onCellChange, onClose }: NotesSidebarProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("lineItem");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const notes = useMemo(() => {
    const entries: NoteEntry[] = [];
    for (const group of data.groups) {
      for (const row of group.rows) {
        for (const [period, cell] of Object.entries(row.values)) {
          if (cell.note) {
            entries.push({
              lineItemId: row.lineItemId,
              lineItemLabel: row.label,
              groupName: group.name,
              period,
              periodLabel: formatPeriodLabel(period),
              note: cell.note,
            });
          }
        }
      }
    }
    return entries;
  }, [data]);

  const sections = useMemo(() => {
    const map = new Map<string, NoteEntry[]>();

    if (groupBy === "lineItem") {
      for (const entry of notes) {
        const key = `${entry.groupName} \u203A ${entry.lineItemLabel}`;
        const list = map.get(key) ?? [];
        list.push(entry);
        map.set(key, list);
      }
      // Sort entries within each section by period
      for (const list of map.values()) {
        list.sort((a, b) => a.period.localeCompare(b.period));
      }
    } else {
      for (const entry of notes) {
        const list = map.get(entry.periodLabel) ?? [];
        list.push(entry);
        map.set(entry.periodLabel, list);
      }
      // Sort section keys by period, entries within by group/line item order
      const sorted = new Map(
        [...map.entries()].sort((a, b) => {
          const pa = a[1][0]?.period ?? "";
          const pb = b[1][0]?.period ?? "";
          return pa.localeCompare(pb);
        })
      );
      return sorted;
    }

    return map;
  }, [notes, groupBy]);

  const startEdit = (lineItemId: string, period: string, currentNote: string) => {
    const key = `${lineItemId}:${period}`;
    setEditingKey(key);
    setEditValue(currentNote);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const commitEdit = (lineItemId: string, period: string) => {
    const trimmed = editValue.trim() || null;
    const current = notes.find(
      (n) => n.lineItemId === lineItemId && n.period === period
    )?.note ?? null;
    if (trimmed !== current) {
      onCellChange({ lineItemId, period, field: "note", value: trimmed });
    }
    setEditingKey(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  return (
    <div className="cf-notes-sidebar cf-notes-sidebar-open">
      <div className="cf-notes-panel">
        <div className="cf-notes-header">
          <h3 className="cf-notes-title">
            Notes <span className="cf-notes-count">({notes.length})</span>
          </h3>
          <button
            className="ghost-btn cf-notes-close"
            onClick={onClose}
            type="button"
            aria-label="Close notes panel"
          >
            {"\u00D7"}
          </button>
        </div>

        <div className="cf-notes-controls">
          <button
            className={`ghost-btn cf-notes-groupby-btn${groupBy === "lineItem" ? " cf-view-mode-active" : ""}`}
            onClick={() => setGroupBy("lineItem")}
            type="button"
          >
            By Item
          </button>
          <button
            className={`ghost-btn cf-notes-groupby-btn${groupBy === "month" ? " cf-view-mode-active" : ""}`}
            onClick={() => setGroupBy("month")}
            type="button"
          >
            By Month
          </button>
        </div>

        <div className="cf-notes-list">
          {notes.length === 0 && (
            <div className="cf-notes-empty">
              No notes yet. Add notes to cells using the dot button in the grid.
            </div>
          )}

          {[...sections.entries()].map(([sectionName, entries]) => (
            <div key={sectionName}>
              <div className="cf-notes-section-header">{sectionName}</div>
              {entries.map((entry) => {
                const key = `${entry.lineItemId}:${entry.period}`;
                const isEditing = editingKey === key;

                return (
                  <div key={key} className="cf-notes-entry">
                    <div className="cf-notes-entry-meta">
                      <span className="cf-notes-entry-label">
                        {groupBy === "lineItem" ? entry.periodLabel : entry.lineItemLabel}
                      </span>
                      {groupBy === "month" && (
                        <span className="cf-notes-entry-group">{entry.groupName}</span>
                      )}
                    </div>

                    {isEditing ? (
                      <div>
                        <textarea
                          ref={textareaRef}
                          className="cf-notes-edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              commitEdit(entry.lineItemId, entry.period);
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          rows={3}
                        />
                        <div className="cf-notes-edit-actions">
                          <button
                            className="cf-notes-edit-save"
                            onClick={() => commitEdit(entry.lineItemId, entry.period)}
                            type="button"
                          >
                            Save
                          </button>
                          <button
                            className="ghost-btn cf-notes-edit-cancel"
                            onClick={cancelEdit}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={`cf-notes-entry-text${editable ? " cf-notes-entry-text-editable" : ""}`}
                        onClick={
                          editable
                            ? () => startEdit(entry.lineItemId, entry.period, entry.note)
                            : undefined
                        }
                        title={editable ? "Click to edit" : undefined}
                      >
                        {entry.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
