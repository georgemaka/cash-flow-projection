import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copySnapshot,
  createSnapshot,
  getSnapshot,
  listSnapshots,
  lockSnapshot,
  unlockSnapshot
} from "../../lib/snapshots/http-handlers";
import {
  AlreadyLockedError,
  AlreadyUnlockedError,
  NotFoundError,
  SourceNotLockedError
} from "../../lib/errors";

function createMockService() {
  return {
    list: vi.fn().mockResolvedValue([{ id: "snap-1" }]),
    getById: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: "snap-new" }),
    lock: vi.fn().mockResolvedValue({ id: "snap-1", status: "locked" }),
    unlock: vi.fn().mockResolvedValue({ id: "snap-1", status: "draft" }),
    copyFromPrior: vi.fn().mockResolvedValue({ id: "snap-copy" })
  };
}

describe("snapshot HTTP handlers", () => {
  const mockService = createMockService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists snapshots", async () => {
    const result = await listSnapshots(mockService);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual([{ id: "snap-1" }]);
  });

  it("gets snapshot by id", async () => {
    mockService.getById.mockResolvedValueOnce({ id: "snap-1" });

    const result = await getSnapshot(mockService, "snap-1");

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ id: "snap-1" });
  });

  it("returns 404 when snapshot is not found", async () => {
    mockService.getById.mockRejectedValueOnce(new NotFoundError("Snapshot not found: missing"));

    const result = await getSnapshot(mockService, "missing");

    expect(result.status).toBe(404);
    expect(result.body.error).toBe("Snapshot not found");
  });

  it("creates snapshot with valid payload", async () => {
    const payload = {
      name: "March 2026",
      asOfMonth: "2026-03",
      createdBy: "user-1"
    };

    const result = await createSnapshot(mockService, payload);

    expect(result.status).toBe(201);
    expect(mockService.create).toHaveBeenCalledWith(payload);
  });

  it("rejects create payload with invalid month format", async () => {
    const payload = {
      name: "March 2026",
      asOfMonth: "2026/03",
      createdBy: "user-1"
    };

    const result = await createSnapshot(mockService, payload);

    expect(result.status).toBe(400);
    expect(String(result.body.error)).toContain("must be in YYYY-MM format");
  });

  it("locks snapshot with valid payload", async () => {
    const result = await lockSnapshot(mockService, {
      snapshotId: "snap-1",
      lockedBy: "admin-1",
      reason: "Month end"
    });

    expect(result.status).toBe(200);
    expect(mockService.lock).toHaveBeenCalledWith({
      snapshotId: "snap-1",
      lockedBy: "admin-1",
      reason: "Month end"
    });
  });

  it("returns 409 if snapshot is already locked", async () => {
    mockService.lock.mockRejectedValueOnce(new AlreadyLockedError());

    const result = await lockSnapshot(mockService, {
      snapshotId: "snap-1",
      lockedBy: "admin-1"
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Snapshot is already locked");
  });

  it("unlocks snapshot with valid payload", async () => {
    const result = await unlockSnapshot(mockService, {
      snapshotId: "snap-1",
      unlockedBy: "admin-1",
      reason: "Correction needed"
    });

    expect(result.status).toBe(200);
    expect(mockService.unlock).toHaveBeenCalledWith({
      snapshotId: "snap-1",
      unlockedBy: "admin-1",
      reason: "Correction needed"
    });
  });

  it("returns 409 if snapshot is already unlocked", async () => {
    mockService.unlock.mockRejectedValueOnce(new AlreadyUnlockedError());

    const result = await unlockSnapshot(mockService, {
      snapshotId: "snap-1",
      unlockedBy: "admin-1"
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Snapshot is already unlocked");
  });

  it("copies snapshot from locked source", async () => {
    const payload = {
      sourceSnapshotId: "snap-locked",
      name: "Q2 2026",
      asOfMonth: "2026-04",
      createdBy: "user-1"
    };

    const result = await copySnapshot(mockService, payload);

    expect(result.status).toBe(201);
    expect(mockService.copyFromPrior).toHaveBeenCalledWith(payload);
  });

  it("returns 409 if copy source snapshot is not locked", async () => {
    mockService.copyFromPrior.mockRejectedValueOnce(new SourceNotLockedError());

    const result = await copySnapshot(mockService, {
      sourceSnapshotId: "snap-draft",
      name: "Q2 2026",
      asOfMonth: "2026-04",
      createdBy: "user-1"
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Can only copy from a locked snapshot");
  });
});
