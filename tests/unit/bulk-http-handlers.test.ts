import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleBulkUpdate, handleBulkRestore } from "../../lib/values/bulk-http-handlers";
import { LockedSnapshotError } from "../../lib/errors";

function createMockService() {
  return {
    preview: vi.fn().mockResolvedValue({ affected: 5, preview: true }),
    apply: vi.fn().mockResolvedValue({ count: 5 }),
    restore: vi.fn().mockResolvedValue({ count: 3 })
  };
}

describe("handleBulkUpdate", () => {
  const mockService = createMockService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls apply and returns 200 when not preview", async () => {
    const result = await handleBulkUpdate(mockService, {
      snapshotId: "snap-1",
      field: "projected",
      operation: "multiply",
      operand: 1.05,
      reason: "Annual increase"
    });

    expect(result.status).toBe(200);
    expect(mockService.apply).toHaveBeenCalled();
    expect(mockService.preview).not.toHaveBeenCalled();
  });

  it("calls preview and returns 200 when preview=true", async () => {
    const result = await handleBulkUpdate(mockService, {
      snapshotId: "snap-1",
      field: "actual",
      operation: "add",
      operand: 500,
      preview: true
    });

    expect(result.status).toBe(200);
    expect(mockService.preview).toHaveBeenCalled();
    expect(mockService.apply).not.toHaveBeenCalled();
  });

  it("returns 400 when reason is missing and not preview", async () => {
    const result = await handleBulkUpdate(mockService, {
      snapshotId: "snap-1",
      field: "projected",
      operation: "multiply",
      operand: 1.05
    });

    expect(result.status).toBe(400);
  });

  it("returns 400 for invalid field", async () => {
    const result = await handleBulkUpdate(mockService, {
      snapshotId: "snap-1",
      field: "bad",
      operation: "multiply",
      operand: 1.05,
      reason: "Test"
    });

    expect(result.status).toBe(400);
  });

  it("returns 409 when snapshot is locked", async () => {
    mockService.apply.mockRejectedValueOnce(
      new LockedSnapshotError("Cannot apply bulk updates to a locked snapshot")
    );

    const result = await handleBulkUpdate(mockService, {
      snapshotId: "snap-locked",
      field: "projected",
      operation: "multiply",
      operand: 1.05,
      reason: "Increase"
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Cannot apply bulk updates to a locked snapshot");
  });

  it("returns 500 on unexpected service error", async () => {
    mockService.apply.mockRejectedValueOnce(new Error("DB down"));

    const result = await handleBulkUpdate(mockService, {
      snapshotId: "snap-1",
      field: "projected",
      operation: "multiply",
      operand: 1.05,
      reason: "Test"
    });

    expect(result.status).toBe(500);
  });
});

describe("handleBulkRestore", () => {
  const mockService = createMockService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls restore and returns 200", async () => {
    const result = await handleBulkRestore(mockService, {
      snapshotId: "snap-1",
      reason: "Revert erroneous update",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });

    expect(result.status).toBe(200);
    expect(mockService.restore).toHaveBeenCalled();
  });

  it("returns 400 for missing reason", async () => {
    const result = await handleBulkRestore(mockService, {
      snapshotId: "snap-1",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });

    expect(result.status).toBe(400);
  });

  it("returns 400 for empty restores array", async () => {
    const result = await handleBulkRestore(mockService, {
      snapshotId: "snap-1",
      reason: "Revert",
      restores: []
    });

    expect(result.status).toBe(400);
  });

  it("returns 409 when snapshot is locked", async () => {
    mockService.restore.mockRejectedValueOnce(
      new LockedSnapshotError("Cannot restore values in a locked snapshot")
    );

    const result = await handleBulkRestore(mockService, {
      snapshotId: "snap-locked",
      reason: "Revert",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Cannot restore values in a locked snapshot");
  });

  it("returns 500 on unexpected service error", async () => {
    mockService.restore.mockRejectedValueOnce(new Error("DB down"));

    const result = await handleBulkRestore(mockService, {
      snapshotId: "snap-1",
      reason: "Revert",
      restores: [{ lineItemId: "li-1", period: "2026-01", projectedAmount: "1000.00" }]
    });

    expect(result.status).toBe(500);
  });
});
