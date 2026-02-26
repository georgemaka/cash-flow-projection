import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generateExcelExport } from "../../lib/exports/excel-export";
import { formatPeriodLong, formatPeriodShort } from "../../lib/exports/types";
import type { ExportSnapshotData } from "../../lib/exports/types";

// ---------------------------------------------------------------------------
// formatPeriodShort / formatPeriodLong
// ---------------------------------------------------------------------------
describe("formatPeriodShort", () => {
  it("returns short month name", () => {
    expect(formatPeriodShort("2026-01")).toBe("Jan");
    expect(formatPeriodShort("2026-06")).toBe("Jun");
    expect(formatPeriodShort("2026-12")).toBe("Dec");
  });
});

describe("formatPeriodLong", () => {
  it("returns month + year", () => {
    expect(formatPeriodLong("2026-01")).toBe("Jan 2026");
    expect(formatPeriodLong("2026-12")).toBe("Dec 2026");
  });
});

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------
function createTestData(overrides: Partial<ExportSnapshotData> = {}): ExportSnapshotData {
  return {
    snapshotName: "Q1 2026 Projection",
    asOfMonth: "2026-03",
    companyName: "Sukut Real Properties",
    periods: ["2026-01", "2026-02", "2026-03"],
    groups: [
      {
        name: "Operating Cash Inflow",
        groupType: "sector",
        lineItems: [
          {
            label: "Rental Income",
            values: {
              "2026-01": { projected: "150000", actual: null },
              "2026-02": { projected: "155000", actual: null },
              "2026-03": { projected: "160000", actual: null }
            }
          },
          {
            label: "Interest Earned",
            values: {
              "2026-01": { projected: "3000", actual: null },
              "2026-02": { projected: "3000", actual: null },
              "2026-03": { projected: "3000", actual: null }
            }
          }
        ]
      },
      {
        name: "Cash Operating Outflows",
        groupType: "sector",
        lineItems: [
          {
            label: "Operating Costs",
            values: {
              "2026-01": { projected: "-50000", actual: null },
              "2026-02": { projected: "-50000", actual: null },
              "2026-03": { projected: "-55000", actual: null }
            }
          }
        ]
      },
      {
        name: "Non-Operating Cash Flow Items",
        groupType: "non_operating",
        lineItems: [
          {
            label: "Debt Payments",
            values: {
              "2026-01": { projected: "-20000", actual: null },
              "2026-02": { projected: "-20000", actual: null },
              "2026-03": { projected: "-20000", actual: null }
            }
          }
        ]
      }
    ],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// generateExcelExport
// ---------------------------------------------------------------------------
describe("generateExcelExport", () => {
  it("returns a valid XLSX buffer", async () => {
    const buffer = await generateExcelExport(createTestData());

    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify it's a valid XLSX by loading it
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets.length).toBe(1);
  });

  it("names the worksheet after the snapshot", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets[0].name).toBe("Q1 2026 Projection");
  });

  it("includes company name in row 1", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe("Sukut Real Properties");
  });

  it("includes month headers in row 6", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    const row6 = ws.getRow(6);
    expect(row6.getCell(3).value).toBe("Jan 2026");
    expect(row6.getCell(4).value).toBe("Feb 2026");
    expect(row6.getCell(5).value).toBe("Mar 2026");
    expect(row6.getCell(6).value).toBe("Total");
  });

  it("includes group headers", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // Find group headers by scanning column A
    const groupHeaders: string[] = [];
    ws.eachRow((row) => {
      const cellA = row.getCell(1).value;
      if (typeof cellA === "string" && cellA.length > 0) {
        groupHeaders.push(cellA);
      }
    });

    expect(groupHeaders).toContain("Operating Cash Inflow");
    expect(groupHeaders).toContain("Cash Operating Outflows");
    expect(groupHeaders).toContain("Non-Operating Cash Flow Items");
  });

  it("includes line items with values", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // Find the "Rental Income" row
    let rentalRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "Rental Income") {
        rentalRow = row;
      }
    });

    expect(rentalRow).not.toBeNull();
    expect((rentalRow as unknown as ExcelJS.Row).getCell(3).value).toBe(150000); // Jan
    expect((rentalRow as unknown as ExcelJS.Row).getCell(4).value).toBe(155000); // Feb
    expect((rentalRow as unknown as ExcelJS.Row).getCell(5).value).toBe(160000); // Mar
  });

  it("calculates correct subtotals per group", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // Find "Total Operating Cash Inflow" row
    let totalRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      const cellB = row.getCell(2).value;
      if (typeof cellB === "string" && cellB.includes("Total Operating Cash Inflow")) {
        totalRow = row;
      }
    });

    expect(totalRow).not.toBeNull();
    // Jan: 150000 + 3000 = 153000
    expect((totalRow as unknown as ExcelJS.Row).getCell(3).value).toBe(153000);
    // Feb: 155000 + 3000 = 158000
    expect((totalRow as unknown as ExcelJS.Row).getCell(4).value).toBe(158000);
    // Mar: 160000 + 3000 = 163000
    expect((totalRow as unknown as ExcelJS.Row).getCell(5).value).toBe(163000);
  });

  it("calculates Net Operating Cash Flow correctly", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    let netOpRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "Net Operating Cash Flow") {
        netOpRow = row;
      }
    });

    expect(netOpRow).not.toBeNull();
    // Jan: (150000+3000) + (-50000) = 103000
    expect((netOpRow as unknown as ExcelJS.Row).getCell(3).value).toBe(103000);
  });

  it("includes Total column with annual sum", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    let rentalRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "Rental Income") {
        rentalRow = row;
      }
    });

    expect(rentalRow).not.toBeNull();
    // Total: 150000 + 155000 + 160000 = 465000
    const totalCol = 3 + 3; // period count + 3
    expect((rentalRow as unknown as ExcelJS.Row).getCell(totalCol).value).toBe(465000);
  });

  it("calculates Net Cash Flow (operating + non-operating)", async () => {
    const buffer = await generateExcelExport(createTestData());

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    let netCashRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "Net Cash Flow") {
        netCashRow = row;
      }
    });

    expect(netCashRow).not.toBeNull();
    // Jan: Operating (103000) + Non-operating (-20000) = 83000
    expect((netCashRow as unknown as ExcelJS.Row).getCell(3).value).toBe(83000);
  });

  it("handles null values (empty cells)", async () => {
    const data = createTestData({
      groups: [
        {
          name: "Test Group",
          groupType: "sector",
          lineItems: [
            {
              label: "Sparse Item",
              values: {
                "2026-01": { projected: "1000", actual: null },
                "2026-02": { projected: null, actual: null },
                "2026-03": { projected: "3000", actual: null }
              }
            }
          ]
        }
      ]
    });

    const buffer = await generateExcelExport(data);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    let sparseRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "Sparse Item") {
        sparseRow = row;
      }
    });

    expect(sparseRow).not.toBeNull();
    expect((sparseRow as unknown as ExcelJS.Row).getCell(3).value).toBe(1000);
    expect((sparseRow as unknown as ExcelJS.Row).getCell(4).value).toBeNull();
    expect((sparseRow as unknown as ExcelJS.Row).getCell(5).value).toBe(3000);
  });

  it("handles empty groups", async () => {
    const data = createTestData({
      groups: [{ name: "Empty Section", groupType: "sector", lineItems: [] }]
    });

    const buffer = await generateExcelExport(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles negative values (outflows)", async () => {
    const data = createTestData({
      groups: [
        {
          name: "Outflows",
          groupType: "sector",
          lineItems: [
            {
              label: "Costs",
              values: {
                "2026-01": { projected: "-50000", actual: null },
                "2026-02": { projected: "-60000", actual: null },
                "2026-03": { projected: "-70000", actual: null }
              }
            }
          ]
        }
      ]
    });

    const buffer = await generateExcelExport(data);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    let costRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "Costs") {
        costRow = row;
      }
    });

    expect(costRow).not.toBeNull();
    expect((costRow as unknown as ExcelJS.Row).getCell(3).value).toBe(-50000);
  });

  it("generates within performance target (<30s per ADR-006)", async () => {
    const start = Date.now();
    await generateExcelExport(createTestData());
    const elapsed = Date.now() - start;

    // ADR-006 says export <30s — this should be well under 1s for test data
    expect(elapsed).toBeLessThan(5000);
  });

  it("handles 12-month full year", async () => {
    const periods = Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, "0");
      return `2026-${month}`;
    });

    const data = createTestData({
      periods,
      groups: [
        {
          name: "Revenue",
          groupType: "sector",
          lineItems: [
            {
              label: "Monthly Income",
              values: Object.fromEntries(
                periods.map((p) => [p, { projected: "100000", actual: null }])
              )
            }
          ]
        }
      ]
    });

    const buffer = await generateExcelExport(data);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // Should have 12 month columns + Total
    const headerRow = ws.getRow(6);
    expect(headerRow.getCell(3).value).toBe("Jan 2026");
    expect(headerRow.getCell(14).value).toBe("Dec 2026");
    expect(headerRow.getCell(15).value).toBe("Total");

    // Total should be 1,200,000
    let incomeRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "Monthly Income") {
        incomeRow = row;
      }
    });
    expect((incomeRow as unknown as ExcelJS.Row).getCell(15).value).toBe(1200000);
  });
});
