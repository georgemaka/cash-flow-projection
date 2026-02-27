import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  parseWorkbook: vi.fn(),
  summarize: vi.fn(),
  confirmImport: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock("@/lib/imports/service-factory", () => ({
  excelImportService: {
    parseWorkbook: mocks.parseWorkbook,
    summarize: mocks.summarize,
    confirmImport: mocks.confirmImport
  }
}));

import { POST } from "@/app/api/imports/excel/route";

describe("POST /api/imports/excel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(null);
  });

  it("returns preview summary in preview mode", async () => {
    mocks.parseWorkbook.mockResolvedValue({ groups: [], periods: [], warnings: [] });
    mocks.summarize.mockReturnValue({ groupCount: 1, lineItemCount: 2, valueCount: 3, periods: [], warnings: [] });

    const file = new File([new Uint8Array([1, 2, 3])], "sample.xlsx");
    const form = new FormData();
    form.append("file", file);
    form.append("mode", "preview");
    form.append("snapshotId", "snap-1");

    const req = new Request("http://localhost/api/imports/excel", { method: "POST", body: form });
    const res = (await POST(req)) as NextResponse;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("preview");
  });

  it("returns 400 when confirm mode is missing snapshotId", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "sample.xlsx");
    const form = new FormData();
    form.append("file", file);
    form.append("mode", "confirm");

    const req = new Request("http://localhost/api/imports/excel", { method: "POST", body: form });
    const res = (await POST(req)) as NextResponse;
    expect(res.status).toBe(400);
  });
});
