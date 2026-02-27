import { beforeEach, describe, expect, it, vi } from "vitest";
import { listValues, upsertValue } from "../../lib/values/http-handlers";
import { MaterialChangeRequiredError } from "../../lib/values/threshold";
import { LockedSnapshotError } from "../../lib/errors";

function createMockService() {
  return {
    list: vi.fn().mockResolvedValue([{ id: "v1" }]),
    upsert: vi.fn().mockResolvedValue({ id: "v1" })
  };
}

describe("value HTTP handlers", () => {
  const mockService = createMockService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists values for snapshot", async () => {
    const result = await listValues(mockService, "snap-1", "grp-1");

    expect(result.status).toBe(200);
    expect(mockService.list).toHaveBeenCalledWith({ snapshotId: "snap-1", groupId: "grp-1" });
  });

  it("requires snapshotId for listing", async () => {
    const result = await listValues(mockService, null);

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("snapshotId is required");
  });

  it("upserts value with valid payload", async () => {
    const result = await upsertValue(mockService, {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "1000.00",
      actualAmount: "950.00",
      note: "Updated",
      updatedBy: "user-1"
    });

    expect(result.status).toBe(200);
    expect(mockService.upsert).toHaveBeenCalledWith({
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "1000.00",
      actualAmount: "950.00",
      note: "Updated",
      updatedBy: "user-1",
      reason: undefined
    });
  });

  it("requires core fields for upsert", async () => {
    const result = await upsertValue(mockService, {
      snapshotId: "snap-1",
      period: "2026-01"
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
  });

  it("validates period format", async () => {
    const result = await upsertValue(mockService, {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026/01"
    });

    expect(result.status).toBe(400);
    expect(String(result.body.error)).toContain("must be in YYYY-MM format");
  });

  it("returns 422 with reason_required when service throws MaterialChangeRequiredError", async () => {
    mockService.upsert.mockRejectedValueOnce(
      new MaterialChangeRequiredError("projectedAmount", 1000, 5000)
    );

    const result = await upsertValue(mockService, {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "15000.00"
    });

    expect(result.status).toBe(422);
    expect(result.body.error).toBe("reason_required");
    expect(result.body.field).toBe("projectedAmount");
    expect(result.body.threshold).toBe(1000);
    expect(result.body.delta).toBe(5000);
  });

  it("passes reason through to service and returns 200", async () => {
    const result = await upsertValue(mockService, {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "15000.00",
      reason: "Revised budget approved in board meeting"
    });

    expect(result.status).toBe(200);
    expect(mockService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Revised budget approved in board meeting" })
    );
  });

  it("returns 409 when snapshot is locked", async () => {
    mockService.upsert.mockRejectedValueOnce(
      new LockedSnapshotError("Cannot edit values in a locked snapshot")
    );

    const result = await upsertValue(mockService, {
      lineItemId: "li-1",
      snapshotId: "snap-locked",
      period: "2026-01",
      projectedAmount: "1000.00"
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Cannot edit values in a locked snapshot");
  });
});
