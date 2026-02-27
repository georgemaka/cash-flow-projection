import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveLineItem,
  createLineItem,
  getLineItem,
  listLineItems,
  updateLineItem
} from "../../lib/line-items/http-handlers";

function createMockService() {
  return {
    list: vi.fn().mockResolvedValue([{ id: "li-1", label: "Rent Revenue" }]),
    getById: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: "li-new", label: "New Item" }),
    update: vi.fn().mockResolvedValue({ id: "li-1", label: "Updated" }),
    archive: vi.fn().mockResolvedValue({ id: "li-1", isActive: false })
  };
}

describe("line item HTTP handlers", () => {
  const mockService = createMockService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists line items", async () => {
    const result = await listLineItems(mockService, "grp-1", false);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual([{ id: "li-1", label: "Rent Revenue" }]);
  });

  it("gets line item by id", async () => {
    mockService.getById.mockResolvedValueOnce({ id: "li-1" });

    const result = await getLineItem(mockService, "li-1");

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ id: "li-1" });
  });

  it("returns 404 when line item is not found", async () => {
    mockService.getById.mockRejectedValueOnce(new Error("No LineItem found"));

    const result = await getLineItem(mockService, "missing");

    expect(result.status).toBe(404);
    expect(result.body.error).toBe("Line item not found");
  });

  it("creates line item with valid payload", async () => {
    const payload = {
      groupId: "grp-1",
      label: "Tenant Rent",
      projectionMethod: "annual_spread",
      projectionParams: { annualTotal: "120000" },
      sortOrder: 1,
      createdBy: "admin-1"
    };

    const result = await createLineItem(mockService, payload);

    expect(result.status).toBe(201);
    expect(mockService.create).toHaveBeenCalledWith(payload);
  });

  it("rejects invalid projection method", async () => {
    const result = await createLineItem(mockService, {
      groupId: "grp-1",
      label: "Tenant Rent",
      projectionMethod: "bad_method"
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
  });

  it("updates line item", async () => {
    const result = await updateLineItem(mockService, {
      lineItemId: "li-1",
      label: "Tenant Rent Updated",
      updatedBy: "editor-1"
    });

    expect(result.status).toBe(200);
    expect(mockService.update).toHaveBeenCalledWith({
      lineItemId: "li-1",
      groupId: undefined,
      label: "Tenant Rent Updated",
      projectionMethod: undefined,
      projectionParams: undefined,
      sortOrder: undefined,
      updatedBy: "editor-1",
      reason: undefined
    });
  });

  it("rejects update with no updatable fields", async () => {
    const result = await updateLineItem(mockService, {
      lineItemId: "li-1",
      updatedBy: "editor-1"
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("No updatable fields provided");
  });

  it("archives line item", async () => {
    const result = await archiveLineItem(mockService, {
      lineItemId: "li-1",
      archivedBy: "admin-1",
      reason: "No longer needed"
    });

    expect(result.status).toBe(200);
    expect(mockService.archive).toHaveBeenCalledWith({
      lineItemId: "li-1",
      archivedBy: "admin-1",
      reason: "No longer needed"
    });
  });

  it("returns 409 when line item is already archived", async () => {
    mockService.archive.mockRejectedValueOnce(new Error("Line item is already archived"));

    const result = await archiveLineItem(mockService, {
      lineItemId: "li-1",
      archivedBy: "admin-1"
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe("Line item is already archived");
  });
});
