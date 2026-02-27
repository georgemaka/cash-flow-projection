"use client";

import type { CompareData, CompareGroupData, CompareRowData } from "./types";
import { deltaClass, formatAmount, formatDelta, formatPeriod } from "./types";

interface CompareGridProps {
  data: CompareData;
  /** Which delta column to show: projected, actual, or both */
  mode: "projected" | "actual" | "both";
}

export function CompareGrid({ data, mode }: CompareGridProps) {
  return (
    <div className="cmp-grid-wrapper">
      <div className="cmp-grid-scroll">
        <table className="cmp-grid">
          <thead>
            <tr>
              <th className="cmp-grid-label-col cmp-grid-sticky">Line Item</th>
              {data.periods.map((p) => (
                <th key={p} className="cmp-grid-period-col">
                  {formatPeriod(p)}
                </th>
              ))}
              <th className="cmp-grid-total-col">Total Δ</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map((group) => (
              <CompareGroupSection
                key={group.id}
                group={group}
                periods={data.periods}
                mode={mode}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CompareGroupSectionProps {
  group: CompareGroupData;
  periods: string[];
  mode: "projected" | "actual" | "both";
}

function CompareGroupSection({ group, periods, mode }: CompareGroupSectionProps) {
  return (
    <>
      <tr className="cmp-group-header">
        <td className="cmp-grid-sticky" colSpan={1}>
          <span className="cmp-group-name">{group.name}</span>
          <span className="cmp-group-type">{group.groupType.replace("_", " ")}</span>
        </td>
        {periods.map((p) => (
          <td key={p} className="cmp-group-cell" />
        ))}
        <td className="cmp-group-cell" />
      </tr>
      {group.rows.map((row) => (
        <CompareRow key={row.lineItemId} row={row} periods={periods} mode={mode} />
      ))}
    </>
  );
}

interface CompareRowProps {
  row: CompareRowData;
  periods: string[];
  mode: "projected" | "actual" | "both";
}

function CompareRow({ row, periods, mode }: CompareRowProps) {
  const calcTotalDelta = (field: "projectedDelta" | "actualDelta"): number => {
    let sum = 0;
    for (const p of periods) {
      const d = row.cells[p]?.[field];
      if (d !== null && d !== undefined) sum += parseFloat(d);
    }
    return sum;
  };

  const projTotalDelta = calcTotalDelta("projectedDelta");
  const actTotalDelta = calcTotalDelta("actualDelta");
  const totalDelta = mode === "actual" ? actTotalDelta : projTotalDelta;
  const totalStr = totalDelta === 0 ? null : totalDelta.toFixed(2);

  return (
    <tr className="cmp-row">
      <td className="cmp-grid-sticky cmp-row-label">
        <span className="cmp-item-label">{row.label}</span>
      </td>
      {periods.map((p) => {
        const cell = row.cells[p];
        if (!cell) {
          return <td key={p} className="cmp-cell" />;
        }

        if (mode === "both") {
          return (
            <td key={p} className="cmp-cell">
              <div className="cmp-cell-both">
                <span className="cmp-cell-sub">
                  <span className="cmp-cell-sub-label">P</span>
                  <span className={`cmp-delta ${deltaClass(cell.projectedDelta)}`}>
                    {formatDelta(cell.projectedDelta)}
                  </span>
                </span>
                <span className="cmp-cell-sub">
                  <span className="cmp-cell-sub-label">A</span>
                  <span className={`cmp-delta ${deltaClass(cell.actualDelta)}`}>
                    {formatDelta(cell.actualDelta)}
                  </span>
                </span>
              </div>
            </td>
          );
        }

        const delta = mode === "projected" ? cell.projectedDelta : cell.actualDelta;
        const aVal = mode === "projected" ? cell.aProjected : cell.aActual;
        const bVal = mode === "projected" ? cell.bProjected : cell.bActual;

        return (
          <td
            key={p}
            className="cmp-cell"
            title={`A: ${formatAmount(aVal)}  B: ${formatAmount(bVal)}`}
          >
            <span className={`cmp-delta ${deltaClass(delta)}`}>{formatDelta(delta)}</span>
          </td>
        );
      })}
      <td className="cmp-total-cell">
        <span className={`cmp-delta ${deltaClass(totalStr)}`}>{formatDelta(totalStr)}</span>
      </td>
    </tr>
  );
}
