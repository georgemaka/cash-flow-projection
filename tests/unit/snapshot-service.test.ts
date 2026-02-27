import { describe, expect, it, vi, beforeEach } from "vitest";
import { SnapshotService } from "../../lib/snapshots";
import { parseAsOfMonth } from "../../lib/snapshots/types";

// ---------------------------------------------------------------------------
// parseAsOfMonth — pure function tests
// ---------------------------------------------------------------------------
describe("parseAsOfMonth", () => {
  it("converts YYYY-MM to first day of month UTC", () => {
    const d = parseAsOfMonth("2026-03");
    expect(d.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("handles January", () => {
    const d = parseAsOfMonth("2026-01");
    expect(d.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles December", () => {
    const d = parseAsOfMonth("2025-12");
    expect(d.toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function createMockAudit() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logSnapshotStatusChange: vi.fn().mockResolvedValue(undefined)
  } as never;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockPrisma(overrides: Record<string, any> = {}): any {
  return {
    snapshot: {
      create: vi.fn().mockResolvedValue({
        id: "snap-new",
        name: "Q1 2026",
        asOfMonth: new Date("2026-03-01T00:00:00.000Z"),
        status: "draft",
        createdBy: "user-1",
        lockedBy: null,
        lockedAt: null,
        structureVersionId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn()
    },
    value: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    structureVersion: {
      create: vi.fn().mockResolvedValue({ id: "sv-1", snapshotId: "snap-1" })
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const self = createMockPrisma(overrides);
      if (overrides.txSnapshotCreate) {
        self.snapshot.create = overrides.txSnapshotCreate;
      }
      if (overrides.txValueCreateMany) {
        self.value.createMany = overrides.txValueCreateMany;
      }
      return fn(self);
    }),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// SnapshotService tests
// ---------------------------------------------------------------------------
describe("SnapshotService", () => {
  let service: SnapshotService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAudit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudit = createMockAudit();
    mockPrisma = createMockPrisma();
    service = new SnapshotService(mockPrisma, mockAudit);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe("create", () => {
    it("creates a draft snapshot", async () => {
      const result = await service.create({
        name: "Q1 2026",
        asOfMonth: "2026-03",
        createdBy: "user-1"
      });

      expect(result.id).toBe("snap-new");
      expect(result.status).toBe("draft");

      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      const createCall = prismaAny.snapshot.create.mock.calls[0][0];
      expect(createCall.data.name).toBe("Q1 2026");
      expect(createCall.data.status).toBe("draft");
      expect(createCall.data.asOfMonth).toEqual(new Date("2026-03-01T00:00:00.000Z"));
    });

    it("logs creation via audit service", async () => {
      await service.create({
        name: "Q1 2026",
        asOfMonth: "2026-03",
        createdBy: "user-1"
      });

      const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
      expect(auditAny.logCreate).toHaveBeenCalledOnce();
      const auditCall = auditAny.logCreate.mock.calls[0][0];
      expect(auditCall.tableName).toBe("Snapshot");
      expect(auditCall.fields.name).toBe("Q1 2026");
      expect(auditCall.fields.status).toBe("draft");
    });
  });

  // -------------------------------------------------------------------------
  // lock
  // -------------------------------------------------------------------------
  describe("lock", () => {
    it("locks a draft snapshot", async () => {
      const draftSnapshot = {
        id: "snap-1",
        status: "draft",
        name: "Q1 2026"
      };
      const lockedSnapshot = { ...draftSnapshot, status: "locked", lockedBy: "admin-1" };

      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(draftSnapshot);

      // Override $transaction to return the locked snapshot
      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          structureVersion: {
            create: vi.fn().mockResolvedValue({ id: "sv-1", snapshotId: "snap-1" })
          },
          snapshot: {
            update: vi.fn().mockResolvedValue(lockedSnapshot)
          }
        };
        return fn(tx);
      }) as never;

      // Re-create service with updated mock
      service = new SnapshotService(mockPrisma, mockAudit);
      const result = await service.lock({
        snapshotId: "snap-1",
        lockedBy: "admin-1",
        reason: "Month-end close"
      });

      expect(result.status).toBe("locked");
    });

    it("throws when snapshot is already locked", async () => {
      const lockedSnapshot = { id: "snap-1", status: "locked" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(lockedSnapshot);

      await expect(service.lock({ snapshotId: "snap-1", lockedBy: "admin-1" })).rejects.toThrow(
        "Snapshot is already locked"
      );
    });

    it("logs status change via audit service", async () => {
      const draftSnapshot = { id: "snap-1", status: "draft" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(draftSnapshot);
      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          structureVersion: { create: vi.fn().mockResolvedValue({ id: "sv-1" }) },
          snapshot: {
            update: vi.fn().mockResolvedValue({ ...draftSnapshot, status: "locked" })
          }
        };
        return fn(tx);
      }) as never;
      service = new SnapshotService(mockPrisma, mockAudit);

      await service.lock({
        snapshotId: "snap-1",
        lockedBy: "admin-1",
        reason: "Month-end close"
      });

      const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
      expect(auditAny.logSnapshotStatusChange).toHaveBeenCalledWith(
        "admin-1",
        "snap-1",
        "draft",
        "locked",
        "Month-end close",
        "ui_edit"
      );
    });

    it("creates a structure version on lock", async () => {
      const draftSnapshot = { id: "snap-1", status: "draft" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(draftSnapshot);

      const mockSvCreate = vi.fn().mockResolvedValue({ id: "sv-1", snapshotId: "snap-1" });
      const mockSnapUpdate = vi
        .fn()
        .mockResolvedValue({ ...draftSnapshot, status: "locked", structureVersionId: "sv-1" });

      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          structureVersion: { create: mockSvCreate },
          snapshot: { update: mockSnapUpdate }
        };
        return fn(tx);
      }) as never;
      service = new SnapshotService(mockPrisma, mockAudit);

      await service.lock({ snapshotId: "snap-1", lockedBy: "admin-1" });

      expect(mockSvCreate).toHaveBeenCalledWith({ data: { snapshotId: "snap-1" } });
      expect(mockSnapUpdate.mock.calls[0][0].data.structureVersionId).toBe("sv-1");
    });

    it("uses status:'draft' in the transaction WHERE to prevent double-lock", async () => {
      // The WHERE clause must include `status: "draft"` so Prisma rejects a
      // concurrent lock attempt atomically (P2025) rather than silently overwriting.
      const draftSnapshot = { id: "snap-1", status: "draft" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(draftSnapshot);

      const mockSnapUpdate = vi
        .fn()
        .mockResolvedValue({ ...draftSnapshot, status: "locked", structureVersionId: "sv-1" });

      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          structureVersion: { create: vi.fn().mockResolvedValue({ id: "sv-1" }) },
          snapshot: { update: mockSnapUpdate }
        };
        return fn(tx);
      }) as never;
      service = new SnapshotService(mockPrisma, mockAudit);

      await service.lock({ snapshotId: "snap-1", lockedBy: "admin-1" });

      const updateWhere = mockSnapUpdate.mock.calls[0][0].where;
      expect(updateWhere).toMatchObject({ id: "snap-1", status: "draft" });
    });
  });

  // -------------------------------------------------------------------------
  // unlock
  // -------------------------------------------------------------------------
  describe("unlock", () => {
    it("unlocks a locked snapshot", async () => {
      const lockedSnapshot = { id: "snap-1", status: "locked", lockedBy: "admin-1" };
      const unlockedSnapshot = {
        ...lockedSnapshot,
        status: "draft",
        lockedBy: null,
        lockedAt: null
      };

      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(lockedSnapshot);
      prismaAny.snapshot.update.mockResolvedValue(unlockedSnapshot);

      const result = await service.unlock({
        snapshotId: "snap-1",
        unlockedBy: "admin-1",
        reason: "Need corrections"
      });

      expect(result.status).toBe("draft");
      expect(result.lockedBy).toBeNull();
    });

    it("throws when snapshot is already unlocked", async () => {
      const draftSnapshot = { id: "snap-1", status: "draft" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(draftSnapshot);

      await expect(service.unlock({ snapshotId: "snap-1", unlockedBy: "admin-1" })).rejects.toThrow(
        "Snapshot is already unlocked"
      );
    });

    it("clears lockedBy and lockedAt on unlock", async () => {
      const lockedSnapshot = {
        id: "snap-1",
        status: "locked",
        lockedBy: "admin-1",
        lockedAt: new Date()
      };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(lockedSnapshot);
      prismaAny.snapshot.update.mockResolvedValue({
        ...lockedSnapshot,
        status: "draft",
        lockedBy: null,
        lockedAt: null
      });

      await service.unlock({ snapshotId: "snap-1", unlockedBy: "admin-1" });

      const updateCall = prismaAny.snapshot.update.mock.calls[0][0];
      expect(updateCall.data.lockedBy).toBeNull();
      expect(updateCall.data.lockedAt).toBeNull();
    });

    it("logs status change via audit service", async () => {
      const lockedSnapshot = { id: "snap-1", status: "locked" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(lockedSnapshot);
      prismaAny.snapshot.update.mockResolvedValue({ ...lockedSnapshot, status: "draft" });

      await service.unlock({
        snapshotId: "snap-1",
        unlockedBy: "admin-1",
        reason: "Need corrections"
      });

      const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
      expect(auditAny.logSnapshotStatusChange).toHaveBeenCalledWith(
        "admin-1",
        "snap-1",
        "locked",
        "draft",
        "Need corrections",
        "ui_edit"
      );
    });

    it("uses status:'locked' in WHERE to prevent concurrent re-lock race condition", async () => {
      // Verify unlock uses an atomic WHERE to prevent the window where a concurrent
      // lock() completes between our pre-check and this update.
      const lockedSnapshot = { id: "snap-1", status: "locked" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(lockedSnapshot);
      prismaAny.snapshot.update.mockResolvedValue({ ...lockedSnapshot, status: "draft" });

      await service.unlock({ snapshotId: "snap-1", unlockedBy: "admin-1" });

      const updateWhere = prismaAny.snapshot.update.mock.calls[0][0].where;
      expect(updateWhere).toMatchObject({ id: "snap-1", status: "locked" });
    });
  });

  // -------------------------------------------------------------------------
  // copyFromPrior
  // -------------------------------------------------------------------------
  describe("copyFromPrior", () => {
    it("creates a new draft from a locked snapshot", async () => {
      const source = { id: "snap-old", status: "locked", name: "Q4 2025" };
      const newSnapshot = { id: "snap-new", status: "draft", name: "Q1 2026" };

      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(source);
      prismaAny.value.findMany.mockResolvedValue([]);

      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          snapshot: { create: vi.fn().mockResolvedValue(newSnapshot) },
          value: { createMany: vi.fn().mockResolvedValue({ count: 0 }) }
        };
        return fn(tx);
      }) as never;
      service = new SnapshotService(mockPrisma, mockAudit);

      const result = await service.copyFromPrior({
        sourceSnapshotId: "snap-old",
        name: "Q1 2026",
        asOfMonth: "2026-03",
        createdBy: "user-1"
      });

      expect(result.id).toBe("snap-new");
      expect(result.status).toBe("draft");
    });

    it("throws when source is not locked", async () => {
      const source = { id: "snap-old", status: "draft" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(source);

      await expect(
        service.copyFromPrior({
          sourceSnapshotId: "snap-old",
          name: "Q1 2026",
          asOfMonth: "2026-03",
          createdBy: "user-1"
        })
      ).rejects.toThrow("Can only copy from a locked snapshot");
    });

    it("copies projected values but NOT actuals (ADR-003)", async () => {
      const source = { id: "snap-old", status: "locked" };
      const sourceValues = [
        {
          id: "v1",
          lineItemId: "li-1",
          snapshotId: "snap-old",
          period: new Date("2025-01-01"),
          projectedAmount: 1000,
          actualAmount: 950,
          note: "original note",
          updatedBy: "old-user"
        },
        {
          id: "v2",
          lineItemId: "li-2",
          snapshotId: "snap-old",
          period: new Date("2025-02-01"),
          projectedAmount: 2000,
          actualAmount: 1800,
          note: "another note",
          updatedBy: "old-user"
        }
      ];

      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(source);
      prismaAny.value.findMany.mockResolvedValue(sourceValues);

      const mockValueCreateMany = vi.fn().mockResolvedValue({ count: 2 });
      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          snapshot: {
            create: vi.fn().mockResolvedValue({ id: "snap-new", status: "draft" })
          },
          value: { createMany: mockValueCreateMany }
        };
        return fn(tx);
      }) as never;
      service = new SnapshotService(mockPrisma, mockAudit);

      await service.copyFromPrior({
        sourceSnapshotId: "snap-old",
        name: "Q1 2026",
        asOfMonth: "2026-03",
        createdBy: "user-1"
      });

      expect(mockValueCreateMany).toHaveBeenCalledOnce();
      const valueData = mockValueCreateMany.mock.calls[0][0].data;
      expect(valueData).toHaveLength(2);

      // Projected amounts ARE copied
      expect(valueData[0].projectedAmount).toBe(1000);
      expect(valueData[1].projectedAmount).toBe(2000);

      // Actuals are NOT copied (ADR-003)
      expect(valueData[0].actualAmount).toBeNull();
      expect(valueData[1].actualAmount).toBeNull();

      // Notes are NOT copied
      expect(valueData[0].note).toBeNull();
      expect(valueData[1].note).toBeNull();
    });

    it("skips value copy when source has no values", async () => {
      const source = { id: "snap-old", status: "locked" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(source);
      prismaAny.value.findMany.mockResolvedValue([]);

      const mockValueCreateMany = vi.fn();
      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          snapshot: {
            create: vi.fn().mockResolvedValue({ id: "snap-new", status: "draft" })
          },
          value: { createMany: mockValueCreateMany }
        };
        return fn(tx);
      }) as never;
      service = new SnapshotService(mockPrisma, mockAudit);

      await service.copyFromPrior({
        sourceSnapshotId: "snap-old",
        name: "Q1 2026",
        asOfMonth: "2026-03",
        createdBy: "user-1"
      });

      expect(mockValueCreateMany).not.toHaveBeenCalled();
    });

    it("logs creation with copiedFrom reference", async () => {
      const source = { id: "snap-old", status: "locked" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(source);
      prismaAny.value.findMany.mockResolvedValue([]);
      prismaAny.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          snapshot: {
            create: vi.fn().mockResolvedValue({ id: "snap-new", status: "draft" })
          },
          value: { createMany: vi.fn() }
        };
        return fn(tx);
      }) as never;
      service = new SnapshotService(mockPrisma, mockAudit);

      await service.copyFromPrior({
        sourceSnapshotId: "snap-old",
        name: "Q1 2026",
        asOfMonth: "2026-03",
        createdBy: "user-1"
      });

      const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
      expect(auditAny.logCreate).toHaveBeenCalledOnce();
      const auditCall = auditAny.logCreate.mock.calls[0][0];
      expect(auditCall.fields.copiedFrom).toBe("snap-old");
      expect(auditCall.fields.status).toBe("draft");
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe("list", () => {
    it("returns snapshots ordered by createdAt desc", async () => {
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findMany.mockResolvedValue([
        { id: "snap-2", name: "Q2" },
        { id: "snap-1", name: "Q1" }
      ]);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(prismaAny.snapshot.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          locker: { select: { id: true, name: true, email: true } }
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe("getById", () => {
    it("returns snapshot with relations", async () => {
      const snapshot = { id: "snap-1", name: "Q1 2026", status: "draft" };
      const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      prismaAny.snapshot.findUniqueOrThrow.mockResolvedValue(snapshot);

      const result = await service.getById("snap-1");

      expect(result.id).toBe("snap-1");
      expect(prismaAny.snapshot.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "snap-1" },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          locker: { select: { id: true, name: true, email: true } },
          structureVersion: true
        }
      });
    });
  });
});
