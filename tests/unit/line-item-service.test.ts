import { beforeEach, describe, expect, it, vi } from "vitest";
import { LineItemService } from "../../lib/line-items/line-item-service";

function createMockAudit() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logArchive: vi.fn().mockResolvedValue(undefined)
  } as never;
}

function createMockPrisma() {
  return {
    lineItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  } as never;
}

describe("LineItemService", () => {
  let service: LineItemService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAudit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockAudit = createMockAudit();
    service = new LineItemService(mockPrisma, mockAudit);
  });

  it("lists only active line items by default", async () => {
    await service.list();

    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    expect(prismaAny.lineItem.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  });

  it("creates line item and logs audit create entries", async () => {
    const created = {
      id: "li-1",
      groupId: "grp-1",
      label: "Rent",
      projectionMethod: "manual",
      sortOrder: 1,
      isActive: true
    };
    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.lineItem.create.mockResolvedValue(created);

    const result = await service.create({
      groupId: "grp-1",
      label: "Rent",
      projectionMethod: "manual",
      sortOrder: 1,
      createdBy: "admin-1"
    });

    expect(result.id).toBe("li-1");
    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logCreate).toHaveBeenCalledOnce();
  });

  it("updates line item and logs field-level changes", async () => {
    const current = {
      id: "li-1",
      groupId: "grp-1",
      label: "Rent",
      projectionMethod: "manual",
      projectionParams: null,
      sortOrder: 1,
      isActive: true,
      archivedAt: null
    };
    const updated = {
      ...current,
      projectionMethod: "annual_spread",
      sortOrder: 2
    };

    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.lineItem.findUniqueOrThrow.mockResolvedValue(current);
    prismaAny.lineItem.update.mockResolvedValue(updated);

    await service.update({
      lineItemId: "li-1",
      projectionMethod: "annual_spread",
      sortOrder: 2,
      updatedBy: "editor-1",
      reason: "Switch to annual estimate"
    });

    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logUpdate).toHaveBeenCalledOnce();
    const changes = auditAny.logUpdate.mock.calls[0][0].changes;
    expect(changes.some((c: { field: string }) => c.field === "projectionMethod")).toBe(true);
    expect(changes.some((c: { field: string }) => c.field === "sortOrder")).toBe(true);
  });

  it("archives line item and logs archive event", async () => {
    const current = {
      id: "li-1",
      isActive: true
    };
    const updated = {
      id: "li-1",
      isActive: false,
      archivedAt: new Date()
    };

    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.lineItem.findUniqueOrThrow.mockResolvedValue(current);
    prismaAny.lineItem.update.mockResolvedValue(updated);

    const result = await service.archive({
      lineItemId: "li-1",
      archivedBy: "admin-1",
      reason: "Deprecated"
    });

    expect(result.isActive).toBe(false);
    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logArchive).toHaveBeenCalledOnce();
  });

  it("throws when trying to archive an already archived line item", async () => {
    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.lineItem.findUniqueOrThrow.mockResolvedValue({ id: "li-1", isActive: false });

    await expect(service.archive({ lineItemId: "li-1", archivedBy: "admin-1" })).rejects.toThrow(
      "Line item is already archived"
    );
  });
});
