import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { ExcelImportService } from "@/lib/imports/excel-import-service";

async function buildWorkbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Residential Properties");
  ws.addRow(["Line Item", "Jan 2026", "Feb 2026"]);
  ws.addRow(["Base Rent", 1000, 1200]);
  ws.addRow(["Utilities", 300, 320]);
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

function createPrismaMock(): PrismaClient {
  const mock = {
    snapshot: {
      findUnique: vi.fn().mockResolvedValue({ id: "snap-1", status: "draft", createdBy: "user-1" })
    },
    group: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "group-1", name: "Residential Properties" })
    },
    lineItem: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "li-1", label: "Base Rent" })
    },
    value: {
      upsert: vi.fn().mockResolvedValue({})
    }
  };

  return mock as unknown as PrismaClient;
}

describe("ExcelImportService", () => {
  it("parses workbook into groups, line items, and periods", async () => {
    const service = new ExcelImportService(createPrismaMock());
    const parsed = await service.parseWorkbook(await buildWorkbookBuffer());

    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].lineItems).toHaveLength(2);
    expect(parsed.periods).toEqual(["2026-01", "2026-02"]);
    expect(parsed.warnings).toEqual([]);
  });

  it("returns summary counts", async () => {
    const service = new ExcelImportService(createPrismaMock());
    const parsed = await service.parseWorkbook(await buildWorkbookBuffer());
    const summary = service.summarize(parsed);

    expect(summary.groupCount).toBe(1);
    expect(summary.lineItemCount).toBe(2);
    expect(summary.valueCount).toBe(4);
  });

  it("confirms import by upserting values into target snapshot", async () => {
    const prisma = createPrismaMock();
    const service = new ExcelImportService(prisma);
    const parsed = await service.parseWorkbook(await buildWorkbookBuffer());
    const summary = await service.confirmImport("snap-1", parsed);

    expect(summary.snapshotId).toBe("snap-1");
    expect(prisma.value.upsert).toHaveBeenCalledTimes(4);
  });
});
