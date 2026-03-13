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
}

/* -----------------------------------------------------------------------
   Helpers
   ----------------------------------------------------------------------- */

function parseNum(v: string | null): number {
  if (v === null) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/* -----------------------------------------------------------------------
   Component
   ----------------------------------------------------------------------- */

export function ListTableView({ data, editable, onCellChange }: ListTableViewProps) {
  // Filters
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [includeEmpty, setIncludeEmpty] = useState(false);

  // Sort
  const [sortCol, setSortCol] = useState<SortColumn>("month");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Inline editing
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

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
      if (searchText) {
        const lower = searchText.toLowerCase();
        if (!r.lineItemLabel.toLowerCase().includes(lower)) return false;
      }
      return true;
    });
  }, [allRows, categoryFilter, monthFilter, searchText]);

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
    field: "projected" | "actual" | "note"
  ) => {
    const value =
      field === "note"
        ? editValue.trim() || null
        : parseCurrencyInput(editValue);

    onCellChange({ lineItemId, period, field, value });
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
    field: "projected" | "actual" | "note"
  ) => {
    if (e.key === "Enter" && (field !== "note" || e.metaKey || e.ctrlKey)) {
      commitEdit(lineItemId, period, field);
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
      {/* Filter bar */}
      <div className="cf-list-filters">
        <input
          className="cf-list-search"
          type="text"
          placeholder="Search line items..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select
          className="cf-list-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          className="cf-list-select"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="">All Months</option>
          {data.periods.map((p) => (
            <option key={p} value={p}>
              {formatPeriodLabel(p)}
            </option>
          ))}
        </select>
        <label className="cf-list-toggle">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.target.checked)}
          />{" "}
          Include empty
        </label>
        <span className="cf-list-count">
          {sortedRows.length} of {allRows.length} rows
        </span>
      </div>

      {/* Table */}
      <div className="cf-list-wrapper">
        <div className="cf-list-scroll">
          <table className="cf-list-table">
            <thead>
              <tr>
                <th className="cf-list-col-item" onClick={() => handleSort("lineItem")}>
                  Line Item
                  <span className="cf-list-sort-icon">{sortIcon("lineItem")}</span>
                </th>
                <th className="cf-list-col-category" onClick={() => handleSort("category")}>
                  Category
                  <span className="cf-list-sort-icon">{sortIcon("category")}</span>
                </th>
                <th className="cf-list-col-month" onClick={() => handleSort("month")}>
                  Month
                  <span className="cf-list-sort-icon">{sortIcon("month")}</span>
                </th>
                <th className="cf-list-col-projected" onClick={() => handleSort("projected")}>
                  Projected
                  <span className="cf-list-sort-icon">{sortIcon("projected")}</span>
                </th>
                <th className="cf-list-col-actual" onClick={() => handleSort("actual")}>
                  Actual
                  <span className="cf-list-sort-icon">{sortIcon("actual")}</span>
                </th>
                <th className="cf-list-col-note" onClick={() => handleSort("note")}>
                  Notes
                  <span className="cf-list-sort-icon">{sortIcon("note")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Add row form */}
              {editable && (
                <tr className="cf-list-add-row">
                  <td className="cf-list-col-item">
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
                  </td>
                  <td className="cf-list-col-category">
                    {/* Auto-filled from item selection */}
                    <span className="cf-list-add-category-hint">
                      {addItemId
                        ? data.groups.find((g) =>
                            g.rows.some((r) => r.lineItemId === addItemId)
                          )?.name ?? ""
                        : ""}
                    </span>
                  </td>
                  <td className="cf-list-col-month">
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
                  </td>
                  <td className="cf-list-col-projected">
                    <input
                      className="cf-list-add-input"
                      type="text"
                      placeholder="0"
                      value={addProjected}
                      onChange={(e) => setAddProjected(e.target.value)}
                    />
                  </td>
                  <td className="cf-list-col-actual">
                    <input
                      className="cf-list-add-input"
                      type="text"
                      placeholder="0"
                      value={addActual}
                      onChange={(e) => setAddActual(e.target.value)}
                    />
                  </td>
                  <td className="cf-list-col-note">
                    <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                      <input
                        className="cf-list-add-input"
                        style={{ width: "100%", textAlign: "left" }}
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
                  </td>
                </tr>
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
                    <td className="cf-list-col-category">{row.groupName}</td>
                    <td className="cf-list-col-month">{row.periodLabel}</td>

                    {/* Projected */}
                    <td className="cf-list-col-projected">
                      {editingKey === `${rowKey}:projected` ? (
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          className="cf-list-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() =>
                            commitEdit(row.lineItemId, row.period, "projected")
                          }
                          onKeyDown={(e) =>
                            handleKeyDown(e, row.lineItemId, row.period, "projected")
                          }
                        />
                      ) : (
                        <span
                          className={editable ? "cf-list-editable" : ""}
                          onDoubleClick={() =>
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
                          onBlur={() =>
                            commitEdit(row.lineItemId, row.period, "actual")
                          }
                          onKeyDown={(e) =>
                            handleKeyDown(e, row.lineItemId, row.period, "actual")
                          }
                        />
                      ) : (
                        <span
                          className={editable ? "cf-list-editable" : ""}
                          onDoubleClick={() =>
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
                          onBlur={() =>
                            commitEdit(row.lineItemId, row.period, "note")
                          }
                          onKeyDown={(e) =>
                            handleKeyDown(e, row.lineItemId, row.period, "note")
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
    </div>
  );
}
