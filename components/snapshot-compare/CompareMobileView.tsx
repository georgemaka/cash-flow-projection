"use client";

import { useState } from "react";
import type { CompareData, CompareGroupData, CompareRowData } from "./types";
import { deltaClass, formatAmount, formatDelta, formatPeriod } from "./types";

interface CompareMobileViewProps {
  data: CompareData;
  mode: "projected" | "actual" | "both";
}

export function CompareMobileView({ data, mode }: CompareMobileViewProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <div className="cmp-mobile">
      {data.groups.map((group) => (
        <MobileGroup
          key={group.id}
          group={group}
          periods={data.periods}
          mode={mode}
          expandedItem={expandedItem}
          onToggle={setExpandedItem}
        />
      ))}
    </div>
  );
}

interface MobileGroupProps {
  group: CompareGroupData;
  periods: string[];
  mode: "projected" | "actual" | "both";
  expandedItem: string | null;
  onToggle: (id: string | null) => void;
}

function MobileGroup({ group, periods, mode, expandedItem, onToggle }: MobileGroupProps) {
  return (
    <div className="cmp-mobile-group">
      <div className="cmp-mobile-group-header">
        <span className="cmp-mobile-group-name">{group.name}</span>
        <span className="cmp-mobile-group-type">{group.groupType.replace("_", " ")}</span>
      </div>
      {group.rows.map((row) => (
        <MobileItemCard
          key={row.lineItemId}
          row={row}
          periods={periods}
          mode={mode}
          expanded={expandedItem === row.lineItemId}
          onToggle={() => onToggle(expandedItem === row.lineItemId ? null : row.lineItemId)}
        />
      ))}
    </div>
  );
}

interface MobileItemCardProps {
  row: CompareRowData;
  periods: string[];
  mode: "projected" | "actual" | "both";
  expanded: boolean;
  onToggle: () => void;
}

function MobileItemCard({ row, periods, mode, expanded, onToggle }: MobileItemCardProps) {
  const totalDelta = (() => {
    let sum = 0;
    const field = mode === "actual" ? "actualDelta" : "projectedDelta";
    for (const p of periods) {
      const d = row.cells[p]?.[field];
      if (d !== null && d !== undefined) sum += parseFloat(d);
    }
    return sum === 0 ? null : sum.toFixed(2);
  })();

  return (
    <div className={`cmp-mobile-card${expanded ? " cmp-mobile-card-expanded" : ""}`}>
      <button className="cmp-mobile-card-header" onClick={onToggle} type="button">
        <span className="cmp-mobile-card-label">{row.label}</span>
        <span className={`cmp-delta cmp-mobile-card-total ${deltaClass(totalDelta)}`}>
          {formatDelta(totalDelta)}
        </span>
        <span className="cmp-mobile-card-chevron">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>
      {expanded && (
        <div className="cmp-mobile-card-body">
          {periods.map((p) => {
            const cell = row.cells[p];
            if (!cell) return null;
            return (
              <div key={p} className="cmp-mobile-month">
                <span className="cmp-mobile-month-label">{formatPeriod(p)}</span>
                {mode === "both" ? (
                  <div className="cmp-mobile-both">
                    <div className="cmp-mobile-field">
                      <span className="cmp-mobile-field-label">Proj Δ</span>
                      <span className={`cmp-delta ${deltaClass(cell.projectedDelta)}`}>
                        {formatDelta(cell.projectedDelta)}
                      </span>
                    </div>
                    <div className="cmp-mobile-field">
                      <span className="cmp-mobile-field-label">Act Δ</span>
                      <span className={`cmp-delta ${deltaClass(cell.actualDelta)}`}>
                        {formatDelta(cell.actualDelta)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="cmp-mobile-both">
                    <div className="cmp-mobile-field">
                      <span className="cmp-mobile-field-label">
                        {mode === "projected" ? "A Proj" : "A Act"}
                      </span>
                      <span className="cmp-mobile-field-value">
                        {formatAmount(mode === "projected" ? cell.aProjected : cell.aActual)}
                      </span>
                    </div>
                    <div className="cmp-mobile-field">
                      <span className="cmp-mobile-field-label">
                        {mode === "projected" ? "B Proj" : "B Act"}
                      </span>
                      <span className="cmp-mobile-field-value">
                        {formatAmount(mode === "projected" ? cell.bProjected : cell.bActual)}
                      </span>
                    </div>
                    <div className="cmp-mobile-field">
                      <span className="cmp-mobile-field-label">Delta</span>
                      <span
                        className={`cmp-delta ${deltaClass(mode === "projected" ? cell.projectedDelta : cell.actualDelta)}`}
                      >
                        {formatDelta(mode === "projected" ? cell.projectedDelta : cell.actualDelta)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
