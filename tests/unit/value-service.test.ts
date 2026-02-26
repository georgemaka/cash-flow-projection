import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePeriod, ValueService } from "../../lib/values/value-service";

function createMockAudit() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined)
  } as never;
}

function createMockPrisma() {
  return {
    value: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  } as never;
}

describe("parsePeriod", () => {
  it("parses YYYY-MM into UTC first day", () => {
    const parsed = parsePeriod("2026-03");
    expect(parsed.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("throws on invalid format", () => {
    expect(() => parsePeriod("2026/03")).toThrow("period must be in YYYY-MM format");
  });
});

describe("ValueService", () => {
  let service: ValueService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAudit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockAudit = createMockAudit();
    service = new ValueService(mockPrisma, mockAudit);
  });

  it("lists values with snapshot/group filters", async () => {
    await service.list({ snapshotId: "snap-1", groupId: "grp-1" });

    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    expect(prismaAny.value.findMany).toHaveBeenCalledWith({
      where: {
        snapshotId: "snap-1",
        lineItem: { groupId: "grp-1" }
      },
      orderBy: [{ period: "asc" }, { createdAt: "asc" }],
      include: {
        lineItem: {
          select: {
            id: true,
            label: true,
            groupId: true,
            projectionMethod: true,
            sortOrder: true
          }
        }
      }
    });
  });

  it("creates new value and logs audit create", async () => {
    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.value.findUnique.mockResolvedValue(null);
    prismaAny.value.upsert.mockResolvedValue({
      id: "v-1",
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: new Date("2026-01-01T00:00:00.000Z"),
      projectedAmount: { toString: () => "1000.00" },
      actualAmount: { toString: () => "900.00" },
      note: "new"
    });

    await service.upsert({
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "1000.00",
      actualAmount: "900.00",
      note: "new",
      updatedBy: "user-1"
    });

    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logCreate).toHaveBeenCalledOnce();
  });

  it("updates existing value and logs audit update", async () => {
    const prismaAny = mockPrisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    prismaAny.value.findUnique.mockResolvedValue({
      id: "v-1",
      projectedAmount: "1000.00",
      actualAmount: "900.00",
      note: "old",
      updatedBy: "user-1"
    });
    prismaAny.value.upsert.mockResolvedValue({
      id: "v-1",
      projectedAmount: "1100.00",
      actualAmount: "900.00",
      note: "revised",
      updatedBy: "user-2"
    });

    await service.upsert({
      lineItemId: "li-1",
      snapshotId: "snap-1",
      period: "2026-01",
      projectedAmount: "1100.00",
      actualAmount: "900.00",
      note: "revised",
      updatedBy: "user-2",
      reason: "variance update"
    });

    const auditAny = mockAudit as Record<string, ReturnType<typeof vi.fn>>;
    expect(auditAny.logUpdate).toHaveBeenCalledOnce();
  });
});