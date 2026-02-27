/**
 * Integration tests for /api/values route handlers.
 *
 * Covers upsert, bulk-update, and bulk-restore endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { MaterialChangeRequiredError } from "@/lib/values/threshold";

vi.mock("@/lib/auth", () => ({
  requireSignedIn: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditorOrAbove: vi.fn()
}));

vi.mock("@/lib/values/service-factory", () => ({
  valueService: {
    list: vi.fn(),
    upsert: vi.fn()
  }
}));

vi.mock("@/lib/values/bulk-factory", () => ({
  bulkValueService: {
    preview: vi.fn(),
    apply: vi.fn(),
    restore: vi.fn()
  }
}));

import { POST as upsertValueRoute } from "@/app/api/values/upsert/route";
import { POST as bulkUpdateRoute } from "@/app/api/values/bulk-update/route";
import { POST as bulkRestoreRoute } from "@/app/api/values/bulk-restore/route";
import { requireEditorOrAbove } from "@/lib/auth";
import { valueService } from "@/lib/values/service-factory";
import { bulkValueService } from "@/lib/values/bulk-factory";

function makeRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function passGuard(mock: unknown) {
  (mock as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

function failGuard401(mock: unknown) {
  (mock as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  );
}

function failGuard403(mock: unknown) {
  (mock as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: "Forbidden" }, { status: 403 })
  );
}

// ── UPSERT value ──────────────────────────────────────────────────────────────

describe("POST /api/values/upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireEditorOrAbove);
    (valueService.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "v1",
      projectedAmount: "1000.00"
    });
  });

  it("upserts value and returns 200", async () => {
    const req = makeRequest("http://localhost/api/values/upsert", {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "1000.00",
      updatedBy: "user-1"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.projectedAmount).toBe("1000.00");
  });

  it("returns 400 for missing required fields", async () => {
    const req = makeRequest("http://localhost/api/values/upsert", {
      snapshotId: "snap-1",
      period: "2026-01"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid period format", async () => {
    const req = makeRequest("http://localhost/api/values/upsert", {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026/01"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 422 with reason_required for material change", async () => {
    (valueService.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(
      new MaterialChangeRequiredError("projectedAmount", 1000, 5000)
    );
    const req = makeRequest("http://localhost/api/values/upsert", {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "15000.00"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("reason_required");
    expect(body.field).toBe("projectedAmount");
  });

  it("returns 409 when snapshot is locked", async () => {
    (valueService.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Cannot edit values in a locked snapshot")
    );
    const req = makeRequest("http://localhost/api/values/upsert", {
      lineItemId: "li-1",
      snapshotId: "snap-locked",
      period: "2026-01",
      projectedAmount: "1000.00"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/values/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireEditorOrAbove);
    const req = makeRequest("http://localhost/api/values/upsert", {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for viewer role", async () => {
    failGuard403(requireEditorOrAbove);
    const req = makeRequest("http://localhost/api/values/upsert", {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01"
    });
    const res = await upsertValueRoute(req);
    expect(res.status).toBe(403);
  });
});

// ── BULK UPDATE values ────────────────────────────────────────────────────────

describe("POST /api/values/bulk-update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireEditorOrAbove);
    (bulkValueService.apply as ReturnType<typeof vi.fn>).mockResolvedValue({
      affected: 12,
      preview: false
    });
    (bulkValueService.preview as ReturnType<typeof vi.fn>).mockResolvedValue({
      affected: 12,
      preview: true
    });
  });

  it("applies bulk update and returns 200", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-1",
      field: "projected",
      operation: "multiply",
      operand: 1.05,
      reason: "Annual 5% increase",
      updatedBy: "admin-1"
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(200);
  });

  it("runs preview without reason and returns 200", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-1",
      field: "projected",
      operation: "add",
      operand: 500,
      preview: true
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 when reason is missing and not preview", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-1",
      field: "projected",
      operation: "multiply",
      operand: 1.05
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid field value", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-1",
      field: "invalid_field",
      operation: "multiply",
      operand: 1.05,
      reason: "Test"
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid operation", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-1",
      field: "projected",
      operation: "divide",
      operand: 2,
      reason: "Test"
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireEditorOrAbove);
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-1",
      field: "projected",
      operation: "multiply",
      operand: 1.05,
      reason: "Test",
      preview: true
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 409 when snapshot is locked", async () => {
    (bulkValueService.apply as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Cannot apply bulk updates to a locked snapshot")
    );
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-locked",
      field: "projected",
      operation: "multiply",
      operand: 1.05,
      reason: "Annual increase"
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(409);
  });

  it("returns 500 on service error", async () => {
    (bulkValueService.apply as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const req = makeRequest("http://localhost/api/values/bulk-update", {
      snapshotId: "snap-1",
      field: "projected",
      operation: "multiply",
      operand: 1.05,
      reason: "Annual increase"
    });
    const res = await bulkUpdateRoute(req);
    expect(res.status).toBe(500);
  });
});

// ── BULK RESTORE values ───────────────────────────────────────────────────────

describe("POST /api/values/bulk-restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passGuard(requireEditorOrAbove);
    (bulkValueService.restore as ReturnType<typeof vi.fn>).mockResolvedValue({
      restored: 3
    });
  });

  it("restores values and returns 200", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-restore", {
      snapshotId: "snap-1",
      reason: "Reverting erroneous bulk update",
      restores: [
        { lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" },
        { lineItemId: "li-1", period: "2026-02", projectedAmount: "1200.00" }
      ]
    });
    const res = await bulkRestoreRoute(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing reason", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-restore", {
      snapshotId: "snap-1",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });
    const res = await bulkRestoreRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty restores array", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-restore", {
      snapshotId: "snap-1",
      reason: "Revert",
      restores: []
    });
    const res = await bulkRestoreRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing snapshotId", async () => {
    const req = makeRequest("http://localhost/api/values/bulk-restore", {
      reason: "Revert",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });
    const res = await bulkRestoreRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    failGuard401(requireEditorOrAbove);
    const req = makeRequest("http://localhost/api/values/bulk-restore", {
      snapshotId: "snap-1",
      reason: "Revert",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });
    const res = await bulkRestoreRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns 409 when snapshot is locked", async () => {
    (bulkValueService.restore as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Cannot restore values in a locked snapshot")
    );
    const req = makeRequest("http://localhost/api/values/bulk-restore", {
      snapshotId: "snap-locked",
      reason: "Revert",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });
    const res = await bulkRestoreRoute(req);
    expect(res.status).toBe(409);
  });

  it("returns 500 on service error", async () => {
    (bulkValueService.restore as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"));
    const req = makeRequest("http://localhost/api/values/bulk-restore", {
      snapshotId: "snap-1",
      reason: "Revert",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });
    const res = await bulkRestoreRoute(req);
    expect(res.status).toBe(500);
  });
});
