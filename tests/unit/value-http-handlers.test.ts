import { beforeEach, describe, expect, it, vi } from "vitest";
import { listValues, upsertValue } from "../../lib/values/http-handlers";

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
    expect(result.body.error).toBe("lineItemId, snapshotId, and period are required");
  });

  it("validates period format", async () => {
    const result = await upsertValue(mockService, {
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026/01"
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("period must be in YYYY-MM format");
  });
});