import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

type GroupType = "sector" | "non_operating" | "custom";

type ParsedValue = {
  period: string;
  projectedAmount: string;
};

type ParsedLineItem = {
  label: string;
  values: ParsedValue[];
};

type ParsedGroup = {
  name: string;
  groupType: GroupType;
  lineItems: ParsedLineItem[];
};

export type ParsedWorkbook = {
  groups: ParsedGroup[];
  periods: string[];
  warnings: string[];
};

export type PreviewSummary = {
  groupCount: number;
  lineItemCount: number;
  valueCount: number;
  periods: string[];
  warnings: string[];
};

export type ConfirmSummary = PreviewSummary & {
  snapshotId: string;
};

function asText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value && value.result !== undefined) {
      return asText(value.result as ExcelJS.CellValue);
    }
  }

  return "";
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const millis = Math.round((serial - 25569) * 86_400_000);
  if (!Number.isFinite(millis)) return null;
  return new Date(millis);
}

function parsePeriod(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  if (typeof value === "number") {
    const maybeDate = excelSerialToDate(value);
    if (maybeDate && !Number.isNaN(maybeDate.getTime())) {
      return `${maybeDate.getUTCFullYear()}-${String(maybeDate.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return null;
  }

  if (typeof value === "object" && value !== null && "result" in value) {
    return parsePeriod(value.result as ExcelJS.CellValue);
  }

  const raw = asText(value);
  if (!raw) return null;

  const yyyymm = raw.match(/^(\d{4})[-/](\d{2})/);
  if (yyyymm) {
    return `${yyyymm[1]}-${yyyymm[2]}`;
  }

  const parsed = new Date(`1 ${raw}`);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return null;
}

function parseProjectedAmount(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "object" && value !== null && "result" in value) {
    return parseProjectedAmount(value.result as ExcelJS.CellValue);
  }

  const raw = asText(value);
  if (!raw) return null;
  const normalized = raw
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(([^)]+)\)/, "-$1")
    .trim();

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed.toFixed(2);
}

function inferGroupType(sheetName: string): GroupType {
  const normalized = sheetName.toLowerCase();
  if (normalized.includes("non-operating") || normalized.includes("non operating")) {
    return "non_operating";
  }

  return "sector";
}

export class ExcelImportService {
  constructor(private readonly prisma: PrismaClient) {}

  async parseWorkbook(buffer: Uint8Array): Promise<ParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();
    const nodeBuffer = Buffer.from(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(nodeBuffer);

    const warnings: string[] = [];
    const groups: ParsedGroup[] = [];
    const periodSet = new Set<string>();

    for (const worksheet of workbook.worksheets) {
      const maxColumns = Math.min(worksheet.columnCount, 120);
      if (maxColumns < 2) continue;

      const periodColumns = new Map<number, string>();
      let headerRowNumber: number | null = null;

      for (let rowNum = 1; rowNum <= Math.min(worksheet.rowCount, 25); rowNum++) {
        const row = worksheet.getRow(rowNum);
        let matches = 0;

        for (let col = 2; col <= maxColumns; col++) {
          const period = parsePeriod(row.getCell(col).value);
          if (period) {
            matches += 1;
            periodColumns.set(col, period);
          }
        }

        if (matches >= 2) {
          headerRowNumber = rowNum;
          break;
        }

        periodColumns.clear();
      }

      if (!headerRowNumber || periodColumns.size === 0) {
        warnings.push(`Sheet "${worksheet.name}" skipped: no period header row detected.`);
        continue;
      }

      const parsedLineItems: ParsedLineItem[] = [];
      for (const period of periodColumns.values()) {
        periodSet.add(period);
      }

      for (let rowNum = headerRowNumber + 1; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const label = asText(row.getCell(1).value);
        if (!label) continue;

        const normalizedLabel = label.toLowerCase();
        if (normalizedLabel.includes("total") || normalizedLabel.includes("subtotal")) {
          continue;
        }

        const values: ParsedValue[] = [];
        for (const [col, period] of periodColumns.entries()) {
          const amount = parseProjectedAmount(row.getCell(col).value);
          if (amount !== null) {
            values.push({ period, projectedAmount: amount });
          }
        }

        if (values.length === 0) continue;
        parsedLineItems.push({ label, values });
      }

      if (parsedLineItems.length === 0) {
        warnings.push(`Sheet "${worksheet.name}" parsed with no line items.`);
        continue;
      }

      groups.push({
        name: worksheet.name.trim(),
        groupType: inferGroupType(worksheet.name),
        lineItems: parsedLineItems
      });
    }

    const periods = Array.from(periodSet).sort();
    if (groups.length === 0) {
      throw new Error("No importable sheets found. Expected period headers and value rows.");
    }

    return { groups, periods, warnings };
  }

  summarize(parsed: ParsedWorkbook): PreviewSummary {
    const lineItemCount = parsed.groups.reduce((acc, g) => acc + g.lineItems.length, 0);
    const valueCount = parsed.groups.reduce(
      (acc, g) => acc + g.lineItems.reduce((inner, li) => inner + li.values.length, 0),
      0
    );

    return {
      groupCount: parsed.groups.length,
      lineItemCount,
      valueCount,
      periods: parsed.periods,
      warnings: parsed.warnings
    };
  }

  async confirmImport(snapshotId: string, parsed: ParsedWorkbook): Promise<ConfirmSummary> {
    const snapshot = await this.prisma.snapshot.findUnique({
      where: { id: snapshotId },
      select: { id: true, status: true, createdBy: true }
    });

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    if (snapshot.status === "locked") {
      throw new Error("Cannot import into a locked snapshot.");
    }

    let nextGroupSort = (await this.prisma.group.count()) + 1;
    const summary = this.summarize(parsed);

    for (const group of parsed.groups) {
      let groupRecord = await this.prisma.group.findFirst({
        where: { name: { equals: group.name, mode: "insensitive" } }
      });

      if (!groupRecord) {
        groupRecord = await this.prisma.group.create({
          data: {
            name: group.name,
            groupType: group.groupType,
            sortOrder: nextGroupSort
          }
        });
        nextGroupSort += 1;
      }

      let nextLineItemSort = (await this.prisma.lineItem.count({ where: { groupId: groupRecord.id } })) + 1;
      for (const lineItem of group.lineItems) {
        let lineItemRecord = await this.prisma.lineItem.findFirst({
          where: {
            groupId: groupRecord.id,
            label: { equals: lineItem.label, mode: "insensitive" }
          }
        });

        if (!lineItemRecord) {
          lineItemRecord = await this.prisma.lineItem.create({
            data: {
              groupId: groupRecord.id,
              label: lineItem.label,
              projectionMethod: "manual",
              sortOrder: nextLineItemSort
            }
          });
          nextLineItemSort += 1;
        }

        for (const value of lineItem.values) {
          await this.prisma.value.upsert({
            where: {
              lineItemId_snapshotId_period: {
                lineItemId: lineItemRecord.id,
                snapshotId: snapshot.id,
                period: new Date(`${value.period}-01T00:00:00.000Z`)
              }
            },
            update: {
              projectedAmount: value.projectedAmount,
              updatedBy: snapshot.createdBy
            },
            create: {
              lineItemId: lineItemRecord.id,
              snapshotId: snapshot.id,
              period: new Date(`${value.period}-01T00:00:00.000Z`),
              projectedAmount: value.projectedAmount,
              updatedBy: snapshot.createdBy
            }
          });
        }
      }
    }

    return {
      ...summary,
      snapshotId
    };
  }
}
