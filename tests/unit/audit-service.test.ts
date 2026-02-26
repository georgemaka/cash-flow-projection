import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuditService, diffFields } from "../../lib/audit";
import type { FieldChange } from "../../lib/audit";

// ---------------------------------------------------------------------------
// diffFields — pure function tests
// ---------------------------------------------------------------------------
describe("diffFields", () => {
  it("detects changed string fields", () => {
    const old = { name: "Rent", sortOrder: "1" };
    const updated = { name: "Rental Income", sortOrder: "1" };
    const changes = diffFields(old, updated, ["name", "sortOrder"]);

    expect(changes).toEqual([{ field: "name", oldValue: "Rent", newValue: "Rental Income" }]);
  });

  it("detects changed numeric fields (coerced to string)", () => {
    const old = { sortOrder: 1 };
    const updated = { sortOrder: 2 };
    const changes = diffFields(old, updated, ["sortOrder"]);

    expect(changes).toEqual([{ field: "sortOrder", oldValue: "1", newValue: "2" }]);
  });

  it("detects null to value change", () => {
    const old = { note: null };
    const updated = { note: "Updated forecast" };
    const changes = diffFields(old, updated, ["note"]);

    expect(changes).toEqual([{ field: "note", oldValue: null, newValue: "Updated forecast" }]);
  });

  it("detects value to null change", () => {
    const old = { note: "Some note" };
    const updated = { note: null };
    const changes = diffFields(old, updated, ["note"]);

    expect(changes).toEqual([{ field: "note", oldValue: "Some note", newValue: null }]);
  });

  it("returns empty array when nothing changed", () => {
    const old = { name: "Rent", sortOrder: 1 };
    const updated = { name: "Rent", sortOrder: 1 };
    const changes = diffFields(old, updated, ["name", "sortOrder"]);

    expect(changes).toEqual([]);
  });

  it("only tracks specified fields", () => {
    const old = { name: "Rent", sortOrder: 1, groupType: "sector" };
    const updated = { name: "Rental", sortOrder: 2, groupType: "custom" };
    const changes = diffFields(old, updated, ["name"]);

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe("name");
  });

  it("handles undefined fields as null", () => {
    const old = {} as Record<string, unknown>;
    const updated = { name: "New" };
    const changes = diffFields(old, updated, ["name"]);

    expect(changes).toEqual([{ field: "name", oldValue: null, newValue: "New" }]);
  });

  it("serializes Date objects to ISO strings", () => {
    const date1 = new Date("2026-01-15T00:00:00.000Z");
    const date2 = new Date("2026-02-15T00:00:00.000Z");
    const old = { archivedAt: date1 };
    const updated = { archivedAt: date2 };
    const changes = diffFields(old, updated, ["archivedAt"]);

    expect(changes).toEqual([
      {
        field: "archivedAt",
        oldValue: "2026-01-15T00:00:00.000Z",
        newValue: "2026-02-15T00:00:00.000Z"
      }
    ]);
  });

  it("serializes boolean fields", () => {
    const old = { isActive: true };
    const updated = { isActive: false };
    const changes = diffFields(old, updated, ["isActive"]);

    expect(changes).toEqual([{ field: "isActive", oldValue: "true", newValue: "false" }]);
  });

  it("handles Decimal-like objects with toFixed", () => {
    const decimalLike = { toFixed: () => "1234.56", toString: () => "1234.56" };
    const old = { amount: decimalLike };
    const updated = { amount: { toFixed: () => "2000.00", toString: () => "2000.00" } };
    const changes = diffFields(old, updated, ["amount"]);

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe("amount");
  });
});

// ---------------------------------------------------------------------------
// AuditService — mock Prisma tests
// ---------------------------------------------------------------------------
describe("AuditService", () => {
  const mockCreateMany = vi.fn().mockResolvedValue({ count: 0 });
  const mockFindMany = vi.fn().mockResolvedValue([]);
  const mockPrisma = {
    auditLog: {
      createMany: mockCreateMany,
      findMany: mockFindMany
    }
  } as never;

  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService(mockPrisma);
  });

  describe("logUpdate", () => {
    it("writes one audit row per changed field", async () => {
      const changes: FieldChange[] = [
        { field: "name", oldValue: "Old", newValue: "New" },
        { field: "sortOrder", oldValue: "1", newValue: "2" }
      ];

      await service.logUpdate({
        userId: "user-1",
        tableName: "Group",
        recordId: "group-1",
        changes,
        reason: "Reorganizing",
        source: "ui_edit"
      });

      expect(mockCreateMany).toHaveBeenCalledOnce();
      const call = mockCreateMany.mock.calls[0][0];
      expect(call.data).toHaveLength(2);
      expect(call.data[0]).toMatchObject({
        userId: "user-1",
        tableName: "Group",
        recordId: "group-1",
        field: "name",
        oldValue: "Old",
        newValue: "New",
        reason: "Reorganizing",
        source: "ui_edit"
      });
      expect(call.data[1].field).toBe("sortOrder");
    });

    it("skips when no changes", async () => {
      await service.logUpdate({
        userId: "user-1",
        tableName: "Group",
        recordId: "group-1",
        changes: [],
        source: "ui_edit"
      });

      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it("does not throw on Prisma error", async () => {
      mockCreateMany.mockRejectedValueOnce(new Error("DB connection lost"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        service.logUpdate({
          userId: "user-1",
          tableName: "Value",
          recordId: "val-1",
          changes: [{ field: "projectedAmount", oldValue: "100", newValue: "200" }],
          source: "ui_edit"
        })
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledOnce();
      consoleSpy.mockRestore();
    });

    it("sets reason to null when not provided", async () => {
      await service.logUpdate({
        userId: "user-1",
        tableName: "LineItem",
        recordId: "li-1",
        changes: [{ field: "label", oldValue: "A", newValue: "B" }],
        source: "api"
      });

      expect(mockCreateMany.mock.calls[0][0].data[0].reason).toBeNull();
    });
  });

  describe("logCreate", () => {
    it("writes entries for all non-null fields", async () => {
      await service.logCreate({
        userId: "user-1",
        tableName: "Group",
        recordId: "group-new",
        fields: { name: "Storage Center", groupType: "sector", sortOrder: "3" },
        source: "ui_edit"
      });

      expect(mockCreateMany).toHaveBeenCalledOnce();
      const data = mockCreateMany.mock.calls[0][0].data;
      expect(data).toHaveLength(3);
      expect(data.every((d: Record<string, unknown>) => d.oldValue === null)).toBe(true);
      expect(data.map((d: Record<string, unknown>) => d.field)).toEqual(
        expect.arrayContaining(["name", "groupType", "sortOrder"])
      );
    });

    it("filters out null/undefined fields", async () => {
      await service.logCreate({
        userId: "user-1",
        tableName: "LineItem",
        recordId: "li-new",
        fields: { label: "New Item", projectionParams: null },
        source: "ui_edit"
      });

      const data = mockCreateMany.mock.calls[0][0].data;
      expect(data).toHaveLength(1);
      expect(data[0].field).toBe("label");
    });

    it("skips when all fields are null", async () => {
      await service.logCreate({
        userId: "user-1",
        tableName: "LineItem",
        recordId: "li-new",
        fields: { note: null },
        source: "ui_edit"
      });

      expect(mockCreateMany).not.toHaveBeenCalled();
    });
  });

  describe("logArchive", () => {
    it("logs isActive change from true to false", async () => {
      await service.logArchive({
        userId: "user-1",
        tableName: "Group",
        recordId: "group-1",
        reason: "No longer needed",
        source: "ui_edit"
      });

      expect(mockCreateMany).toHaveBeenCalledOnce();
      const data = mockCreateMany.mock.calls[0][0].data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        field: "isActive",
        oldValue: "true",
        newValue: "false",
        reason: "No longer needed"
      });
    });
  });

  describe("logSnapshotStatusChange", () => {
    it("logs status transition", async () => {
      await service.logSnapshotStatusChange(
        "admin-1",
        "snap-1",
        "draft",
        "locked",
        "Month-end close",
        "ui_edit"
      );

      expect(mockCreateMany).toHaveBeenCalledOnce();
      const data = mockCreateMany.mock.calls[0][0].data;
      expect(data[0]).toMatchObject({
        userId: "admin-1",
        tableName: "Snapshot",
        field: "status",
        oldValue: "draft",
        newValue: "locked",
        reason: "Month-end close"
      });
    });
  });

  describe("getHistory", () => {
    it("queries with correct params and default limit", async () => {
      await service.getHistory("Value", "val-1");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { tableName: "Value", recordId: "val-1" },
        orderBy: { timestamp: "desc" },
        take: 100,
        include: { user: { select: { id: true, name: true, email: true } } }
      });
    });

    it("respects custom limit", async () => {
      await service.getHistory("Group", "grp-1", 25);

      expect(mockFindMany.mock.calls[0][0].take).toBe(25);
    });
  });

  describe("getFieldHistory", () => {
    it("queries for specific field", async () => {
      await service.getFieldHistory("Value", "val-1", "projectedAmount");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { tableName: "Value", recordId: "val-1", field: "projectedAmount" },
        orderBy: { timestamp: "desc" },
        take: 50,
        include: { user: { select: { id: true, name: true, email: true } } }
      });
    });
  });

  describe("source taxonomy", () => {
    it.each(["ui_edit", "import", "bulk_action", "api"] as const)(
      "accepts source: %s",
      async (source) => {
        await service.logUpdate({
          userId: "user-1",
          tableName: "Value",
          recordId: "val-1",
          changes: [{ field: "projectedAmount", oldValue: "100", newValue: "200" }],
          source
        });

        expect(mockCreateMany.mock.calls[0][0].data[0].source).toBe(source);
      }
    );
  });
});
