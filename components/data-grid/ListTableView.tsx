"use client";

import { useMemo, useRef, useState } from "react";
import type { GridData, PendingEdit } from "./types";
import { formatPeriodLabel, formatCurrency, parseCurrencyInput } from "./types";

/* -----------------------------------------------------------------------
   Types
   ----------------------------------------------------------------------- */

interface ListRow {
  lineItemId: string;
  lineItemLabel: string;
  groupId: string;
  groupName: string;
  period: string;
  periodLabel: string;
  projected: string | null;
  actual: string | null;
  note: string | null;
  dirty: boolean;
}

type SortColumn = "lineItem" | "category" | "month" | "projected" | "actual" | "note";
type SortDir = "asc" | "desc";

interface ListTableViewProps {
  data: GridData;
  editable: boolean;
  onCellChange: (edit: PendingEdit) => void;
  onMoveToGroup?: (lineItemId: string, newGroupId: string) => Promise<void>;
}

/* -----------------------------------------------------------------------
   Helpers
   ----------------------------------------------------------------------- */

function parseNum(v: string | null): number {
  if (v === null) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function matchesTextFilter(value: string | null, filter: string): boolean {
  if (!filter) return true;
  return (value ?? "").toLowerCase().includes(filter.trim().toLowerCase());
}

function matchesValueFilter(value: string | null, filter: string): boolean {
  const trimmed = filter.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  const raw = value ?? "";
  const formatted = formatCurrency(value).toLowerCase();

  return raw.toLowerCase().includes(lower) || formatted.includes(lower);
}

/* -----------------------------------------------------------------------
   Component
   ----------------------------------------------------------------------- */

export function ListTableView({ data, editable, onCellChange, onMoveToGroup }: ListTableViewProps) {
  // Filters
  const [lineItemFilter, setLineItemFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [projectedFilter, setProjectedFilter] = useState("");
  const [actualFilter, setActualFilter] = useState("");
  const [notesFilter, setNotesFilter] = useState("");
  const [includeEmpty, setIncludeEmpty] = useState(false);

  // Sort
  const [sortCol, setSortCol] = useState<SortColumn>("month");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Inline editing
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Category editing
  const [editingCategoryItem, setEditingCategoryItem] = useState<string | null>(null);

  // Add row
  const [addItemId, setAddItemId] = useState("");
  const [addPeriod, setAddPeriod] = useState("");
  const [addProjected, setAddProjected] = useState("");
  const [addActual, setAddActual] = useState("");
  const [addNote, setAddNote] = useState("");

  /* -- Flatten grid data into rows ------------------------------------ */

  const allRows = useMemo(() => {
    const entries: ListRow[] = [];
    for (const group of data.groups) {
      for (const row of group.rows) {
        // Iterate all periods (not just row.values keys) so "Include empty" works
        const periods = includeEmpty ? data.periods : Object.keys(row.values);
        for (const period of periods) {
          const cell = row.values[period] ?? {
            projected: null,
            actual: null,
            note: null,
            dirty: false,
          };
          if (
            !includeEmpty &&
            cell.projected === null &&
            cell.actual === null &&
            cell.note === null
          ) {
            continue;
          }
          entries.push({
            lineItemId: row.lineItemId,
            lineItemLabel: row.label,
            groupId: group.id,
            groupName: group.name,
            period,
            periodLabel: formatPeriodLabel(period),
            projected: cell.projected,
            actual: cell.actual,
            note: cell.note,
            dirty: cell.dirty,
          });
        }
      }
    }
    return entries;
  }, [data, includeEmpty]);

  /* -- Filter --------------------------------------------------------- */

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (categoryFilter && r.groupId !== categoryFilter) return false;
      if (monthFilter && r.period !== monthFilter) return false;
      if (!matchesTextFilter(r.lineItemLabel, lineItemFilter)) return false;
      if (!matchesValueFilter(r.projected, projectedFilter)) return false;
      if (!matchesValueFilter(r.actual, actualFilter)) return false;
      if (!matchesTextFilter(r.note, notesFilter)) return false;
      return true;
    });
  }, [
    actualFilter,
    allRows,
    categoryFilter,
    lineItemFilter,
    monthFilter,
    notesFilter,
    projectedFilter,
  ]);

  /* -- Sort ----------------------------------------------------------- */

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "lineItem":
          cmp = a.lineItemLabel.localeCompare(b.lineItemLabel);
          break;
        case "category":
          cmp = a.groupName.localeCompare(b.groupName);
          break;
        case "month":
          cmp = a.period.localeCompare(b.period);
          break;
        case "projected":
          cmp = parseNum(a.projected) - parseNum(b.projected);
          break;
        case "actual":
          cmp = parseNum(a.actual) - parseNum(b.actual);
          break;
        case "note":
          cmp = (a.note ?? "").localeCompare(b.note ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortCol, sortDir]);

  /* -- Sort toggle ---------------------------------------------------- */

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col: SortColumn) => {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  /* -- Inline editing ------------------------------------------------- */

  const startEdit = (
    lineItemId: string,
    period: string,
    field: "projected" | "actual" | "note",
    currentValue: string | null
  ) => {
    if (!editable) return;
    setEditingKey(`${lineItemId}:${period}:${field}`);
    setEditValue(currentValue ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = (
    lineItemId: string,
    period: string,
    field: "projected" | "actual" | "note",
    currentValue: string | null
  ) => {
    const value = field === "note" ? editValue.trim() || null : parseCurrencyInput(editValue);

    if (value !== currentValue) {
      onCellChange({ lineItemId, period, field, value });
    }
    setEditingKey(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    lineItemId: string,
    period: string,
    field: "projected" | "actual" | "note",
    currentValue: string | null
  ) => {
    if (e.key === "Enter" && (field !== "note" || e.metaKey || e.ctrlKey)) {
      commitEdit(lineItemId, period, field, currentValue);
    }
    if (e.key === "Escape") cancelEdit();
  };

  /* -- Add row -------------------------------------------------------- */

  // Build lookup for existing data to show "(has data)" in dropdowns
  const existingCells = useMemo(() => {
    const set = new Set<string>();
    for (const group of data.groups) {
      for (const row of group.rows) {
        for (const [period, cell] of Object.entries(row.values)) {
          if (cell.projected !== null || cell.actual !== null || cell.note !== null) {
            set.add(`${row.lineItemId}:${period}`);
          }
        }
      }
    }
    return set;
  }, [data]);

  const handleAddRow = () => {
    if (!addItemId || !addPeriod) return;
    const proj = parseCurrencyInput(addProjected);
    const act = parseCurrencyInput(addActual);
    const note = addNote.trim() || null;

    if (proj !== null) {
      onCellChange({ lineItemId: addItemId, period: addPeriod, field: "projected", value: proj });
    }
    if (act !== null) {
      onCellChange({ lineItemId: addItemId, period: addPeriod, field: "actual", value: act });
    }
    if (note !== null) {
      onCellChange({ lineItemId: addItemId, period: addPeriod, field: "note", value: note });
    }

    // Reset form
    setAddProjected("");
    setAddActual("");
    setAddNote("");
  };

  /* -- Render --------------------------------------------------------- */

  return (
    <div>
      {/* Table */}
      <div className="cf-list-wrapper">
        <div className="cf-list-scroll">
          <table className="cf-list-table">
            <thead>
              <tr className="cf-list-header-row">
                <th className="cf-list-col-item">
                  <button className="cf-list-sort-btn" onClick={() => handleSort("lineItem")} type="button">
                    Line Item
                    <span className="cf-list-sort-icon">{sortIcon("lineItem")}</span>
                  </button>
                </th>
                <th className="cf-list-col-category">
                  <button className="cf-list-sort-btn" onClick={() => handleSort("category")} type="button">
                    Category
                    <span className="cf-list-sort-icon">{sortIcon("category")}</span>
                  </button>
                </th>
                <th className="cf-list-col-month">
                  <button className="cf-list-sort-btn" onClick={() => handleSort("month")} type="button">
                    Month
                    <span className="cf-list-sort-icon">{sortIcon("month")}</span>
                  </button>
                </th>
                <th className="cf-list-col-projected">
                  <button className="cf-list-sort-btn" onClick={() => handleSort("projected")} type="button">
                    Projected
                    <span className="cf-list-sort-icon">{sortIcon("projected")}</span>
                  </button>
                </th>
                <th className="cf-list-col-actual">
                  <button className="cf-list-sort-btn" onClick={() => handleSort("actual")} type="button">
                    Actual
                    <span className="cf-list-sort-icon">{sortIcon("actual")}</span>
                  </button>
                </th>
                <th className="cf-list-col-note">
                  <button className="cf-list-sort-btn" onClick={() => handleSort("note")} type="button">
                    Notes
                    <span className="cf-list-sort-icon">{sortIcon("note")}</span>
                  </button>
                </th>
              </tr>
              <tr className="cf-list-filter-row">
                <th className="cf-list-col-item">
                  <input
                    className="cf-list-filter-input"
                    type="text"
                    placeholder="Filter items"
                    value={lineItemFilter}
                    onChange={(e) => setLineItemFilter(e.target.value)}
                  />
                </th>
                <th className="cf-list-col-category">
                  <select
                    className="cf-list-filter-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {data.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="cf-list-col-month">
                  <select
                    className="cf-list-filter-select"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                  >
                    <option value="">All months</option>
                    {data.periods.map((p) => (
                      <option key={p} value={p}>
                        {formatPeriodLabel(p)}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="cf-list-col-projected">
                  <input
                    className="cf-list-filter-input"
                    type="text"
                    placeholder="Filter values"
                    value={projectedFilter}
                    onChange={(e) => setProjectedFilter(e.target.value)}
                  />
                </th>
                <th className="cf-list-col-actual">
                  <input
                    className="cf-list-filter-input"
                    type="text"
                    placeholder="Filter values"
                    value={actualFilter}
                    onChange={(e) => setActualFilter(e.target.value)}
                  />
                </th>
                <th className="cf-list-col-note">
                  <input
                    className="cf-list-filter-input"
                    type="text"
                    placeholder="Filter notes"
                    value={notesFilter}
                    onChange={(e) => setNotesFilter(e.target.value)}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Add row form */}
              {editable && (
                <>
                  <tr className="cf-list-add-row-header">
                    <td colSpan={6}>
                      <div className="cf-list-add-row-banner">
                        <span className="cf-list-add-row-title">Add Entry</span>
                        <span className="cf-list-add-row-desc">
                          Choose an item and month, then enter any projected, actual, or note values.
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr className="cf-list-add-row">
                    <td className="cf-list-col-item">
                      <label className="cf-list-add-field">
                        <span className="cf-list-add-label">Line Item</span>
                        <select
                          className="cf-list-add-select"
                          value={addItemId}
                          onChange={(e) => setAddItemId(e.target.value)}
                        >
                          <option value="">Select item...</option>
                          {data.groups.map((g) => (
                            <optgroup key={g.id} label={g.name}>
                              {g.rows.map((r) => (
                                <option key={r.lineItemId} value={r.lineItemId}>
                                  {r.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td className="cf-list-col-category">
                      <div className="cf-list-add-field">
                        <span className="cf-list-add-label">Category</span>
                        <span className="cf-list-add-category-hint">
                          {addItemId
                            ? data.groups.find((g) =>
                                g.rows.some((r) => r.lineItemId === addItemId)
                              )?.name ?? ""
                            : "Auto-filled from item"}
                        </span>
                      </div>
                    </td>
                    <td className="cf-list-col-month">
                      <label className="cf-list-add-field">
                        <span className="cf-list-add-label">Month</span>
                        <select
                          className="cf-list-add-select"
                          value={addPeriod}
                          onChange={(e) => setAddPeriod(e.target.value)}
                        >
                          <option value="">Month...</option>
                          {data.periods.map((p) => (
                            <option key={p} value={p}>
                              {formatPeriodLabel(p)}
                              {addItemId && existingCells.has(`${addItemId}:${p}`)
                                ? " (has data)"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td className="cf-list-col-projected">
                      <label className="cf-list-add-field">
                        <span className="cf-list-add-label">Projected</span>
                        <input
                          className="cf-list-add-input"
                          type="text"
                          placeholder="0"
                          value={addProjected}
                          onChange={(e) => setAddProjected(e.target.value)}
                        />
                      </label>
                    </td>
                    <td className="cf-list-col-actual">
                      <label className="cf-list-add-field">
                        <span className="cf-list-add-label">Actual</span>
                        <input
                          className="cf-list-add-input"
                          type="text"
                          placeholder="0"
                          value={addActual}
                          onChange={(e) => setAddActual(e.target.value)}
                        />
                      </label>
                    </td>
                    <td className="cf-list-col-note">
                      <label className="cf-list-add-field">
                        <span className="cf-list-add-label">Notes</span>
                        <div className="cf-list-add-note-wrap">
                          <input
                            className="cf-list-add-input cf-list-add-note-input"
                            type="text"
                            placeholder="Note..."
                            value={addNote}
                            onChange={(e) => setAddNote(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddRow();
                            }}
                          />
                          <button
                            className="cf-list-add-btn"
                            onClick={handleAddRow}
                            disabled={!addItemId || !addPeriod}
                            type="button"
                          >
                            Add
                          </button>
                        </div>
                      </label>
                    </td>
                  </tr>
                </>
              )}

              {/* Data rows */}
              {sortedRows.map((row) => {
                const rowKey = `${row.lineItemId}:${row.period}`;
                return (
                  <tr
                    key={rowKey}
                    className={`cf-list-row${row.dirty ? " cf-list-row-dirty" : ""}`}
                  >
                    <td className="cf-list-col-item">{row.lineItemLabel}</td>
                    <td className="cf-list-col-category">
                      {editable && onMoveToGroup && editingCategoryItem === row.lineItemId ? (
                        <select
                          className="cf-list-add-select"
                          value={row.groupId}
                          autoFocus
                          onChange={async (e) => {
                            const newGroupId = e.target.value;
                            if (newGroupId !== row.groupId) {
                              await onMoveToGroup(row.lineItemId, newGroupId);
                            }
                            setEditingCategoryItem(null);
                          }}
                          onBlur={() => setEditingCategoryItem(null)}
                        >
                          {data.groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={editable && onMoveToGroup ? "cf-list-editable" : ""}
                          onClick={
                            editable && onMoveToGroup
                              ? () => setEditingCategoryItem(row.lineItemId)
                              : undefined
                          }
                        >
                          {row.groupName}
                        </span>
                      )}
                    </td>
                    <td className="cf-list-col-month">{row.periodLabel}</td>

                    {/* Projected */}
                    <td className="cf-list-col-projected">
                      {editingKey === `${rowKey}:projected` ? (
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          className="cf-list-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(row.lineItemId, row.period, "projected", row.projected)}
                          onKeyDown={(e) =>
                            handleKeyDown(e, row.lineItemId, row.period, "projected", row.projected)
                          }
                        />
                      ) : (
                        <span
                          className={editable ? "cf-list-editable" : ""}
                          onClick={() =>
                            startEdit(
                              row.lineItemId,
                              row.period,
                              "projected",
                              row.projected
                            )
                          }
                        >
                          {formatCurrency(row.projected)}
                        </span>
                      )}
                    </td>

                    {/* Actual */}
                    <td className="cf-list-col-actual">
                      {editingKey === `${rowKey}:actual` ? (
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          className="cf-list-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(row.lineItemId, row.period, "actual", row.actual)}
                          onKeyDown={(e) =>
                            handleKeyDown(e, row.lineItemId, row.period, "actual", row.actual)
                          }
                        />
                      ) : (
                        <span
                          className={editable ? "cf-list-editable" : ""}
                          onClick={() =>
                            startEdit(
                              row.lineItemId,
                              row.period,
                              "actual",
                              row.actual
                            )
                          }
                        >
                          {formatCurrency(row.actual)}
                        </span>
                      )}
                    </td>

                    {/* Note */}
                    <td className="cf-list-col-note">
                      {editingKey === `${rowKey}:note` ? (
                        <textarea
                          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                          className="cf-list-note-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(row.lineItemId, row.period, "note", row.note)}
                          onKeyDown={(e) =>
                            handleKeyDown(e, row.lineItemId, row.period, "note", row.note)
                          }
                          rows={2}
                        />
                      ) : (
                        <span
                          className={`cf-list-note-text${editable ? " cf-list-editable" : ""}`}
                          onClick={() =>
                            startEdit(row.lineItemId, row.period, "note", row.note)
                          }
                          title={row.note ?? undefined}
                        >
                          {row.note ?? "\u2014"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="cf-list-empty">
                    {allRows.length === 0
                      ? "No data yet. Use the Add row above or enter values in the grid view."
                      : "No rows match the current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="cf-list-status-bar">
        <label className="cf-list-toggle">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.target.checked)}
          />
          Include empty
        </label>
        <span className="cf-list-count">
          Showing {sortedRows.length} of {allRows.length}
        </span>
      </div>
    </div>
  );
}
