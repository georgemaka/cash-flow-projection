import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupService } from "../../lib/groups/group-service";

function createMockAudit() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logArchive: vi.fn().mockResolvedValue(undefined)
  } as never;
}

function createMockPrisma() {
  return {
    group: {
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  } as never;
}

describe("GroupService", () => {
  let service: GroupService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAudit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockAudit = createMockAudit();
    service = new GroupService(mockPrisma, mockAudit);
  });

  it("lists only active groups by default", async () => {
    await service.list();

    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    expect(prismaAny.group.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  });

  it("creates group and logs audit create entries", async () => {
    const created = {
      id: "grp-1",
      name: "Rent",
      groupType: "sector",
      sortOrder: 1,
      isActive: true
    };
    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.group.create.mockResolvedValue(created);

    const result = await service.create({
      name: "Rent",
      groupType: "sector",
      sortOrder: 1,
      createdBy: "admin-1"
    });

    expect(result.id).toBe("grp-1");
    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logCreate).toHaveBeenCalledOnce();
  });

  it("updates group and logs field-level changes", async () => {
    const current = {
      id: "grp-1",
      name: "Rent",
      groupType: "sector",
      sortOrder: 1,
      isActive: true,
      archivedAt: null
    };
    const updated = {
      ...current,
      name: "Rental Income",
      sortOrder: 2
    };

    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.group.findUniqueOrThrow.mockResolvedValue(current);
    prismaAny.group.update.mockResolvedValue(updated);

    await service.update({
      groupId: "grp-1",
      name: "Rental Income",
      sortOrder: 2,
      updatedBy: "admin-1",
      reason: "Reordered"
    });

    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logUpdate).toHaveBeenCalledOnce();
    const changes = auditAny.logUpdate.mock.calls[0][0].changes;
    expect(changes.some((c: { field: string }) => c.field === "name")).toBe(true);
    expect(changes.some((c: { field: string }) => c.field === "sortOrder")).toBe(true);
  });

  it("archives group and logs archive event", async () => {
    const current = {
      id: "grp-1",
      isActive: true
    };
    const updated = {
      id: "grp-1",
      isActive: false,
      archivedAt: new Date()
    };

    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.group.findUniqueOrThrow.mockResolvedValue(current);
    prismaAny.group.update.mockResolvedValue(updated);

    const result = await service.archive({
      groupId: "grp-1",
      archivedBy: "admin-1",
      reason: "Deprecated"
    });

    expect(result.isActive).toBe(false);
    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logArchive).toHaveBeenCalledOnce();
  });

  it("throws when trying to archive an already archived group", async () => {
    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.group.findUniqueOrThrow.mockResolvedValue({ id: "grp-1", isActive: false });

    await expect(service.archive({ groupId: "grp-1", archivedBy: "admin-1" })).rejects.toThrow(
      "Group is already archived"
    );
  });
});
