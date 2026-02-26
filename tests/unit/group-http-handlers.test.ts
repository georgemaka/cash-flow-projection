import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveGroup,
  createGroup,
  getGroup,
  listGroups,
  updateGroup
} from "../../lib/groups/http-handlers";

function createMockService() {
  return {
    list: vi.fn().mockResolvedValue([{ id: "grp-1", name: "Rent" }]),
    getById: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: "grp-new", name: "Other" }),
    update: vi.fn().mockResolvedValue({ id: "grp-1", name: "Updated" }),
    archive: vi.fn().mockResolvedValue({ id: "grp-1", isActive: false })
  };
}

describe("group HTTP handlers", () => {
  const mockService = createMockService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists groups", async () => {
    const result = await listGroups(mockService, false);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual([{ id: "grp-1", name: "Rent" }]);
  });

  it("gets group by id", async () => {
    mockService.getById.mockResolvedValueOnce({ id: "grp-1" });

    const result = await getGroup(mockService, "grp-1");

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ id: "grp-1" });
  });

  it("returns 404 when group is not found", async () => {
    mockService.getById.mockRejectedValueOnce(new Error("No Group found"));

    const result = await getGroup(mockService, "missing");

    expect(result.status).toBe(404);
    expect(result.body.error).toBe("Group not found");
  });

  it("creates group with valid payload", async () => {
    const result = await createGroup(mockService, {
      name: "Non-Operating",
      groupType: "non_operating",
      sortOrder: 3,
      createdBy: "admin-1"
    });

    expect(result.status).toBe(201);
    expect(mockService.create).toHaveBeenCalledWith({
      name: "Non-Operating",
      groupType: "non_operating",
      sortOrder: 3,
      createdBy: "admin-1"
    });
  });

  it("rejects create payload when required fields are missing", async () => {
    const result = await createGroup(mockService, {
      name: ""
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("name and groupType are required");
  });

  it("updates group with valid payload", async () => {
    const result = await updateGroup(mockService, {
      groupId: "grp-1",
      name: "Storage",
      updatedBy: "admin-1"
    });

    expect(result.status).toBe(200);
    expect(mockService.update).toHaveBeenCalledWith({
      groupId: "grp-1",
      name: "Storage",
      groupType: undefined,
      sortOrder: undefined,
      updatedBy: "admin-1",
      reason: undefined
    });
  });

  it("rejects update payload when no updatable fields were provided", async () => {
    const result = await updateGroup(mockService, {
      groupId: "grp-1",
      updatedBy: "admin-1"
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("No updatable fields provided");
  });

  it("archives group", async () => {
    const result = await archiveGroup(mockService, {
      groupId: "grp-1",
      archivedBy: "admin-1",
      reason: "Consolidated"
    });

    expect(result.status).toBe(200);
    expect(mockService.archive).toHaveBeenCalledWith({
      groupId: "grp-1",
      archivedBy: "admin-1",
      reason: "Consolidated"
    });
  });

  it("returns 409 when group is already archived", async () => {
    mockService.archive.mockRejectedValueOnce(new Error("Group is already archived"));

    const result = await archiveGroup(mockService, {
      groupId: "grp-1",
      archivedBy: "admin-1"
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Group is already archived");
  });
});
