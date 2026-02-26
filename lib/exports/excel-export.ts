import ExcelJS from "exceljs";
import Decimal from "decimal.js";
import type { ExportGroup, ExportSnapshotData } from "./types";
import { formatPeriodLong } from "./types";

/**
 * Number format matching the original workbook:
 * - Thousands separator
 * - Negative numbers in parentheses
 * - No decimal places (whole dollars)
 */
const CURRENCY_FORMAT = '#,##0;(#,##0);"-"';

/**
 * Generate an Excel workbook matching the Sukut cash flow projection layout.
 *
 * Layout (replicating the original workbook):
 * - Row 1: Company name (bold, large)
 * - Row 2: Snapshot name + year
 * - Row 3: As-of date
 * - Row 4: blank
 * - Row 5: Actual/Projected labels per month
 * - Row 6: Month headers + "Total" column
 * - Data rows: Group headers → line items → subtotals
 * - Separator rows between sections
 * - Net Operating Cash Flow summary
 * - Non-Operating section
 * - Grand total (Net Cash Flow)
 */
export async function generateExcelExport(
  data: ExportSnapshotData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sukut Properties Cash Flow";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(data.snapshotName, {
    views: [{ state: "frozen", ySplit: 6, xSplit: 2 }]
  });

  const periodCount = data.periods.length;
  const totalCol = periodCount + 3; // Col A (group) + Col B (label) + months + total

  // ── Column widths ──
  ws.getColumn(1).width = 30; // Group name
  ws.getColumn(2).width = 28; // Line item label
  for (let i = 0; i < periodCount; i++) {
    ws.getColumn(i + 3).width = 15;
  }
  ws.getColumn(totalCol).width = 18; // Total column

  // ── Styles ──
  const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 14, name: "Calibri" };
  const subHeaderFont: Partial<ExcelJS.Font> = { bold: true, size: 11, name: "Calibri" };
  const groupFont: Partial<ExcelJS.Font> = { bold: true, size: 11, name: "Calibri" };
  const dataFont: Partial<ExcelJS.Font> = { size: 11, name: "Calibri" };
  const subtotalFont: Partial<ExcelJS.Font> = { bold: true, size: 11, name: "Calibri" };

  const subtotalBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    bottom: { style: "double" }
  };

  // ── Row 1: Company name ──
  const r1 = ws.addRow([data.companyName]);
  r1.font = headerFont;

  // ── Row 2: Snapshot name ──
  const r2 = ws.addRow([data.snapshotName]);
  r2.font = subHeaderFont;

  // ── Row 3: As-of date ──
  const r3 = ws.addRow([`As of ${formatPeriodLong(data.asOfMonth)}`]);
  r3.font = dataFont;

  // ── Row 4: blank ──
  ws.addRow([]);

  // ── Row 5: Actual/Projected labels ──
  // For now, all months show "Projected" — actuals will be labeled when data indicates
  const labelRow = ["", ""];
  for (const _p of data.periods) {
    labelRow.push("Projected");
  }
  labelRow.push("");
  const r5 = ws.addRow(labelRow);
  r5.font = { ...dataFont, italic: true };
  r5.alignment = { horizontal: "center" };

  // ── Row 6: Month headers ──
  const headerRow = ["", ""];
  for (const period of data.periods) {
    headerRow.push(formatPeriodLong(period));
  }
  headerRow.push("Total");
  const r6 = ws.addRow(headerRow);
  r6.font = subHeaderFont;
  r6.alignment = { horizontal: "center" };
  r6.eachCell((cell, colNumber) => {
    if (colNumber >= 3) {
      cell.border = { bottom: { style: "thin" } };
    }
  });

  // ── Separate operating and non-operating groups ──
  const operatingGroups = data.groups.filter((g) => g.groupType !== "non_operating");
  const nonOperatingGroups = data.groups.filter((g) => g.groupType === "non_operating");

  // ── Operating groups ──
  const operatingSubtotals: Decimal[][] = [];

  for (const group of operatingGroups) {
    const groupSubtotals = writeGroupSection(ws, group, data.periods, {
      groupFont,
      dataFont,
      subtotalFont,
      subtotalBorder
    });
    operatingSubtotals.push(groupSubtotals);

    // % Change row (placeholder)
    const pctRow = ws.addRow(["", "% Change from Prior Year"]);
    pctRow.font = { ...dataFont, italic: true, color: { argb: "FF808080" } };

    // Blank separator
    ws.addRow([]);
  }

  // ── Net Operating Cash Flow ──
  const netOpValues: string[] = [];
  const netOpRow = ["", "Net Operating Cash Flow"];
  let netOpTotal = new Decimal(0);

  for (let i = 0; i < data.periods.length; i++) {
    let periodNet = new Decimal(0);
    for (const groupTotals of operatingSubtotals) {
      periodNet = periodNet.plus(groupTotals[i]);
    }
    netOpValues.push(periodNet.toFixed(2));
    netOpTotal = netOpTotal.plus(periodNet);
    netOpRow.push(periodNet.toNumber() as never);
  }
  netOpRow.push(netOpTotal.toNumber() as never);

  const netOpExcelRow = ws.addRow(netOpRow);
  netOpExcelRow.font = { bold: true, size: 12, name: "Calibri" };
  netOpExcelRow.eachCell((cell, colNumber) => {
    if (colNumber >= 3) {
      cell.numFmt = CURRENCY_FORMAT;
      cell.border = { top: { style: "thin" }, bottom: { style: "double" } };
    }
  });

  ws.addRow([]); // separator

  // ── Non-Operating groups ──
  if (nonOperatingGroups.length > 0) {
    const nonOpSubtotals: Decimal[][] = [];

    for (const group of nonOperatingGroups) {
      const groupSubtotals = writeGroupSection(ws, group, data.periods, {
        groupFont,
        dataFont,
        subtotalFont,
        subtotalBorder
      });
      nonOpSubtotals.push(groupSubtotals);
      ws.addRow([]);
    }

    // ── Total Non-Operating ──
    const totalNonOpRow = ["", "Total Non-Operating Cash Flow"];
    let totalNonOp = new Decimal(0);
    for (let i = 0; i < data.periods.length; i++) {
      let periodNet = new Decimal(0);
      for (const groupTotals of nonOpSubtotals) {
        periodNet = periodNet.plus(groupTotals[i]);
      }
      totalNonOp = totalNonOp.plus(periodNet);
      totalNonOpRow.push(periodNet.toNumber() as never);
    }
    totalNonOpRow.push(totalNonOp.toNumber() as never);

    const totalNonOpExcelRow = ws.addRow(totalNonOpRow);
    totalNonOpExcelRow.font = subtotalFont;
    totalNonOpExcelRow.eachCell((cell, colNumber) => {
      if (colNumber >= 3) {
        cell.numFmt = CURRENCY_FORMAT;
        cell.border = subtotalBorder;
      }
    });

    ws.addRow([]);

    // ── Net Cash Flow (Operating + Non-Operating) ──
    const netCashRow = ["", "Net Cash Flow"];
    let netCashTotal = new Decimal(0);
    for (let i = 0; i < data.periods.length; i++) {
      let opTotal = new Decimal(0);
      for (const groupTotals of operatingSubtotals) {
        opTotal = opTotal.plus(groupTotals[i]);
      }
      let nonOpTotal = new Decimal(0);
      for (const groupTotals of nonOpSubtotals) {
        nonOpTotal = nonOpTotal.plus(groupTotals[i]);
      }
      const net = opTotal.plus(nonOpTotal);
      netCashTotal = netCashTotal.plus(net);
      netCashRow.push(net.toNumber() as never);
    }
    netCashRow.push(netCashTotal.toNumber() as never);

    const netCashExcelRow = ws.addRow(netCashRow);
    netCashExcelRow.font = { bold: true, size: 12, name: "Calibri" };
    netCashExcelRow.eachCell((cell, colNumber) => {
      if (colNumber >= 3) {
        cell.numFmt = CURRENCY_FORMAT;
        cell.border = { top: { style: "medium" }, bottom: { style: "double" } };
      }
    });
  }

  // ── Write to buffer ──
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Write a group section: header row, line item rows, subtotal row.
 * Returns per-period subtotals as Decimal array for upstream aggregation.
 */
function writeGroupSection(
  ws: ExcelJS.Worksheet,
  group: ExportGroup,
  periods: string[],
  styles: {
    groupFont: Partial<ExcelJS.Font>;
    dataFont: Partial<ExcelJS.Font>;
    subtotalFont: Partial<ExcelJS.Font>;
    subtotalBorder: Partial<ExcelJS.Borders>;
  }
): Decimal[] {
  // Group header row
  const groupRow = ws.addRow([group.name]);
  groupRow.font = styles.groupFont;

  // Per-period subtotals
  const periodTotals: Decimal[] = periods.map(() => new Decimal(0));
  let grandTotal = new Decimal(0);

  // Line item rows
  for (const item of group.lineItems) {
    const row: (string | number | null)[] = ["", item.label];

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const val = item.values[period];
      // Use projected amount, fallback to actual, fallback to null
      const amount = val?.projected ?? val?.actual ?? null;
      if (amount !== null) {
        const dec = new Decimal(amount);
        periodTotals[i] = periodTotals[i].plus(dec);
        grandTotal = grandTotal.plus(dec);
        row.push(dec.toNumber());
      } else {
        row.push(null);
      }
    }

    // Total column
    let lineTotal = new Decimal(0);
    for (let i = 0; i < periods.length; i++) {
      const val = item.values[periods[i]];
      const amount = val?.projected ?? val?.actual ?? null;
      if (amount !== null) {
        lineTotal = lineTotal.plus(new Decimal(amount));
      }
    }
    row.push(lineTotal.toNumber());

    const dataRow = ws.addRow(row);
    dataRow.font = styles.dataFont;
    dataRow.eachCell((cell, colNumber) => {
      if (colNumber >= 3) {
        cell.numFmt = CURRENCY_FORMAT;
      }
    });
  }

  // Subtotal row
  const subtotalLabel = `Total ${group.name}`;
  const subtotalRow: (string | number)[] = ["", subtotalLabel];
  for (const t of periodTotals) {
    subtotalRow.push(t.toNumber());
  }
  subtotalRow.push(grandTotal.toNumber());

  const subtotalExcelRow = ws.addRow(subtotalRow);
  subtotalExcelRow.font = styles.subtotalFont;
  subtotalExcelRow.eachCell((cell, colNumber) => {
    if (colNumber >= 3) {
      cell.numFmt = CURRENCY_FORMAT;
      cell.border = styles.subtotalBorder;
    }
  });

  return periodTotals;
}
